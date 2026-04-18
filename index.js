const express = require('express');
const app = express();
require('dotenv').config();
var jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// For create connection with admin
const admin = require("firebase-admin");

const serviceAccount = require("./smart-deals-firebase-adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// Middleware
app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
    console.log('Logging Information');
    next();
}
// For cheacking authorization
const verifyFBToken = async (req, res, next) => {
    console.log("Verify Middle Ware", req.headers.authorization);

    if (!req.headers.authorization) {

        // don't allow
        return res.status(401).send(message, "Unauthorized");
    }
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
        // don't allow
        return res.status(401).send({ message: "Unauthorized" });

    }
    // verify token
    try {
        const userToken = await admin.auth().verifyIdToken(token);

        console.log("After Token Validation", userToken)

        // email ta ber kore nilam
        req.token_email = userToken.email;


        // jodi validate hoi taile next kore dibo
        next()
    }

    catch {
        return res.status(401).send(message, "Unauthorized");

    }


    const verifyJWTToken = (req, res, next) => {
        const authorization = req.headers.authorization;
        if (!authorization) {
            // don't allow
            return res.status(401).send(message, "Unauthorized");
        }
        const token = authorization.split(' ')[1];
        if (!token) {
            // don't allow
            return res.status(401).send({ message: "Unauthorized" });

        }

        jwt.verify(token, process.env.JNW_SECRET,(err,decoded)=>{
            if(err){
                           return res.status(403).send({ message: "Forbidden" });
 
            }
            next()
        })
    }
}


}

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-k50mwtj-shard-00-00.4j5c4iq.mongodb.net:27017,ac-k50mwtj-shard-00-01.4j5c4iq.mongodb.net:27017,ac-k50mwtj-shard-00-02.4j5c4iq.mongodb.net:27017/?ssl=true&replicaSet=atlas-xqdkdv-shard-0&authSource=admin&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db("smart_db");
        const productsCollection = db.collection('products');
        const bidsCollection = db.collection('bids');
        const usersCollection = db.collection('users');

        // Jwt Api

        app.post('/getToken', (req, res) => {
            const loggedUser = req.body
            const token = jwt.sign(loggedUser, process.env.JWT_SECRET, { expiresIn: '1h' })

            res.send({ token: token })
        })

        // Users API
        app.post("/users", async (req, res) => {
            const newUsers = req.body;
            const email = req.body.email;
            const query = { email };

            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: "User Already Exists" });
            }

            const result = await usersCollection.insertOne(newUsers);
            res.send(result);
        });

        // Products API
        app.get('/products', async (req, res) => {
            const email = req.query.email;
            const query = {};

            if (email) {
                query.email = email;
            }

            const result = await productsCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/latest-products', async (req, res) => {
            const result = await productsCollection
                .find()
                .sort({ created_at: -1 })
                .limit(6)
                .toArray();

            res.send(result);
        });

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await productsCollection.findOne(query);
            res.send(result);
        });

        app.post("/products", async (req, res) => {
            const newProduct = req.body;
            const result = await productsCollection.insertOne(newProduct);
            res.send(result);
        });

        app.delete("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        });

        app.patch("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateProduct = req.body;

            const update = {
                $set: {
                    name: updateProduct.name,
                    price: updateProduct.price
                }
            };

            const result = await productsCollection.updateOne(query, update);
            res.send(result);
        });

        // Bids API
        app.get("/bids", logger, verifyFBToken, async (req, res) => {
            try {
                const email = req.query.email;
                const query = {};

                if (email) {
                    if (email !== req.token_email) {
                        return res.status(403).send({ message: 'forbidden access' })
                    }
                    query.buyer_email = email;
                }

                const result = await bidsCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: error.message });
            }
        });

        app.get('/products/bids/:productId', verifyFBToken, async (req, res) => {
            const productId = req.params.productId;
            const query = { product: productId };

            const result = await bidsCollection
                .find(query)
                .sort({ bid_price: -1 })
                .toArray();

            res.send(result);
        });

        app.post('/bids', async (req, res) => {
            const newBid = req.body;
            const result = await bidsCollection.insertOne(newBid);
            res.send(result);
        });

        app.delete('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await bidsCollection.deleteOne(query);
            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Smart Server is Running");
});

app.listen(port, () => {
    console.log(`Smart Server Is Running On ${port}`);
});