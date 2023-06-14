const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// MiddleWare
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4hg5zjk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("kidsClubDB").collection("users");
    const classCollection = client.db("kidsClubDB").collection("classes");
    const studentClassCollection = client.db("kidsClubDB").collection("selectedclasses");
    const paymentCollection = client.db("kidsClubDB").collection("payments");
    const enrollmentCollection = client.db("kidsClubDB").collection("enrollment");

    // JWT 

    app.post('/jwt', async(req, res) => {
      const user = req.body;
      
      const query = { email: req.body.email }
      const userrole = await usersCollection.findOne(query);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token,userInfo:userrole })
    })

    // Verify Admin

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

      // Verify Instructor

      const verifyInstructor = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        if (user?.role !== 'instructor') {
          return res.status(403).send({ error: true, message: 'forbidden message' });
        }
        next();
      }
  



    // Users related APIS

    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })


    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = {email : user.email}
      const existingUser = await usersCollection.findOne(query);
      if(existingUser){
        return res.send({message: "User already exists"})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // check admin

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })


     // check students

     app.get('/users/student/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ student: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { student: user?.role === 'student' }
      res.send(result);
    })


// update students to admin

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    // check instractor

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

// update students to instractor

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })




    // Class related APIS


    /* All Class */
    app.get('/allClasses', async(req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })


  

    /*  Class add by Instructor */

    app.post('/classes', verifyJWT, async(req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    })

    /*  Class for specific email by instructor */
    app.get('/classes', verifyJWT, async(req, res) => {
     
      const email = req.decoded.email;
     
      // console.log("The email: ", email);
      if(!email){
        res.send([]);
      }
      const query = { email : email};
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })

    /* Class Status Approved by ADmin*/ 

    app.put('/classes/status/approved/:id', async(req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          classstatus: 'approved'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

      /* Class Status Deny by ADmin*/ 

      app.put('/classes/status/deny/:id', async(req, res) => {
        const id = req.params.id;
        console.log(id);
        const filter = { _id: new ObjectId(id) };
  
        const updateDoc = {
          $set: {
            classstatus: 'deny'
          },
        };
  
        const result = await classCollection.updateOne(filter, updateDoc);
        res.send(result);
  
      })

         /* Class Feedback send by ADmin*/ 

         app.put('/classes/feedback/:id/:feedback', async(req, res) => {
          const id = req.params.id;
          const feedback =  req.params.feedback;
          console.log(id, feedback);
          const filter = { _id: new ObjectId(id) };
    
          const updateDoc = {
            $set: {

              feedback: feedback,
            },
          };
    
          const result = await classCollection.updateOne(filter, updateDoc);
          res.send(result);
    
        })
    
        /* All Approved Classes */

        app.get('/approvedclasses', async(req, res) => {
          const classstatus = 'approved';
          const query = { classstatus : classstatus};
          const result = await classCollection.find(query).toArray();
          res.send(result);
        })

        /**Select class by students */

        app.post('/selectedclases', async(req, res) => {
          const selectedclasses = req.body;
          const result = await studentClassCollection.insertOne(selectedclasses);
          res.send(result);
        })

        /**Selected all class for students */
        
        app.get('/selectedclases', verifyJWT, async(req, res) => {
          const email = req.decoded.email;
          if(!email){
            res.send([]);
          }
          const query = { email : email};

          const result = await studentClassCollection.find(query).toArray();
          res.send(result);
        })


        /* Delete selected class by students */
        app.delete('/selectedclases/:id', async (req, res) => {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const result = await studentClassCollection.deleteOne(query);
          res.send(result);
        }) 

        /* Select specific class info for payment*/ 
        app.get('/selectedclass/:classid', async (req, res) => {
          const id = req.params.classid;
          const query = { _id: new ObjectId(id) };
          const result = await studentClassCollection.findOne(query);
          res.send(result);
        })

        /* create payment intent*/
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
          const { price } = req.body;
          const amount = parseInt(price * 100);
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
          });
    
          res.send({
            clientSecret: paymentIntent.client_secret
          })
        })

          // payment related apis

          /** */
          app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment.paymentInfo);
            const insertEnrollment = await enrollmentCollection.insertOne(payment.classInfo);

            const filter = { _id: new ObjectId(payment.classes.selectedClassId) };
            const updateDoc = {
              $set: {
                availseats: payment.classes.availseats,
                totalenrolledstudents:  payment.classes.totalenrolledstudents
              },
            };
      
            const updateEnrollment = await classCollection.updateOne(filter, updateDoc )

            const insertedPaymentSelectClassId = insertResult.paymentSelectClassId;
            const query = { _id: new ObjectId(payment.classInfo._id) };
            const deleteResult = await studentClassCollection.deleteOne(query);

      

            res.send({ insertResult, deleteResult });
          })
      
       /* get single class  */
      app.get('/singleClass/:id', async(req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await classCollection.findOne(query);
        res.send(result);
      })

          //** PAyment history */

          app.get('/paymentshistory', verifyJWT, async (req, res) => {
            const email = req.decoded.email;
          if(!email){
            res.send([]);
          }
          const query = { email : email};

          const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
          res.send(result);

          })

        


         


    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Kids Club Running ')
})

app.listen(port, () => {
    console.log(`Kids Club On Running On Port : ${port}`)
})

