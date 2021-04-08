const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
// const fs = require('fs-extra');
const fileUpload = require('express-fileupload');
const admin = require('firebase-admin');
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;

const SSLCommerz = require('sslcommerz-nodejs');

let settings = {
  isSandboxMode: true, //false if live version
  store_id: "devel60562f6a15795",
  store_passwd: "devel60562f6a15795@ssl"
}
let sslcommerz = new SSLCommerz(settings);




require('dotenv').config()


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8jj3c.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;


const app = express()

// app.use(bodyParser.json());
app.use(cors());
app.use(fileUpload());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

var serviceAccount = require("./configs/dailyneeds-6ea60-firebase-adminsdk-xu8oq-a0a4b9fb72.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const port = 5000;

app.get('/', (req, res) => {
  res.send('Hello World! Daily Needs Sajib')
})




// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });




client.connect(err => {
  const productsCollection = client.db("dailyNeeds").collection("products");
  const ordersCollection = client.db("dailyNeeds").collection("orders");
  const adminCollection = client.db("dailyNeeds").collection("admin");
  console.log('database connected')

  app.post('/addProducts', (req, res) => {
    const key = req.body.key;
    const name = req.body.name;
    const category = req.body.category;
    const subCategory = req.body.subCategory;
    const price = req.body.price;
    const brand = req.body.brandName;
    const description = req.body.description;

    const file = req.files.file;
    const newImg = file.data;
    const encImg = newImg.toString('base64');
    var image = {
      contentType: req.files.file.mimetype,
      size: req.files.file.size,
      img: Buffer.from(encImg, 'base64')
    };

    productsCollection.insertOne({ key, name, category, subCategory, price, image, brand, description })
      .then(result => {
        res.send(result.insertedCount > 0);
      })
  })

  app.post('/productsByKeys', (req, res) => {
    const productsKeys = req.body;
    productsCollection.find({ key: { $in: productsKeys } })
      .toArray((err, documents) => {
        res.send(documents);
      })

  })

  app.get('/products', (req, res) => {
    productsCollection.find({})
      .toArray((err, documents) => {
        res.send(documents);
      })
  })

  app.get('/admin', (req, res) => {
    adminCollection.find({})
      .toArray((err, documents) => {
        res.send(documents);
      })
  })

  app.delete('/deleteproduct/:id', (req, res) => {
    const id = ObjectId(req.params.id);
    // console.log('delete this', id);
    productsCollection.findOneAndDelete({ _id: id })
      .then(documents => res.send(!!documents.value))
  })

  app.delete('/admindelete/:id', (req, res) => {
    const id = ObjectId(req.params.id);
    // console.log('delete this', id);
    adminCollection.findOneAndDelete({ _id: id })
      .then(documents => res.send(!!documents.value))
  })



  app.post('/addAdmin', (req, res) => {
    const admin = req.body;
    // console.log(admin)
    adminCollection.insertOne(admin)
      .then(result => {
        res.send(result.insertedCount > 0);
      })
  })

  app.post('/isAdmin', (req, res) => {
    const email = req.body.email;
    adminCollection.find({ email: email })
      .toArray((err, admin) => {
        if (err) {
          console.log(err)
        }
        else {
          res.send(admin.length > 0);
        }
      })
  })

  app.patch('/update/:id', (req, res) => {
    // console.log(req.body)
    // console.log(req.params.id)
    productsCollection.updateOne({ _id: ObjectId(req.params.id) },
      {
        $set: { price: req.body.newPrice }
      })
      .then(result => {
        res.send(result.modifiedCount > 0)
      })
  })

  app.get('/orders', (req, res) => {
    const bearer = req.headers.authorization;
    // console.log(bearer);
    ordersCollection.find({})
      .toArray((err, documents) => {
        res.send(documents);
      })
  })

  app.post('/addOrders', (req, res) => {
    const order = req.body;
    console.log(order)
    ordersCollection.insertOne(order)
      .then(result => {
        // console.log(result.insertedCount > 0)
        res.send(result.insertedCount > 0);
      })
  })

  app.patch("/updateOrder/:id", (req, res) => {
    console.log(req.params.id)
    ordersCollection.updateOne(
      { _id: ObjectId(req.params.id) },
      {
        $set: { status: req.body.status }
      })
      .then(result => {
        res.send(result.modifiedCount > 0);
      })
  })

  app.get('/customerOrders', (req, res) => {
    const bearer = req.headers.authorization;
    // const queryEmail = req.query.email;
    // console.log(bearer, queryEmail)
    if (bearer && bearer.startsWith('Bearer ')) {
      const idToken = bearer.split(' ')[1];
      admin.auth().verifyIdToken(idToken)
        .then(function (decodedToken) {
          const tokenEmail = decodedToken.email;
          const queryEmail = req.query.email;
          if (tokenEmail == queryEmail) {
            ordersCollection.find({ email: queryEmail })
              .toArray((err, documents) => {
                res.status(200).send(documents);
              })
          }
        }).catch(function (error) {
          res.status(401).send('Un authorized access')
        });
    }
    else {
      res.status(401).send('Un authorized access')
    }
  })

let orders ;
  app.post('/pay', (req, res) => {
    const data = req.body
    orders = data;    
    let post_body = {};
    post_body['total_amount'] = data.amount;
    post_body['currency'] = "BDT";
    post_body['tran_id'] = "12345";
    post_body['success_url'] = "https://guarded-bastion-31565.herokuapp.com/success";
    post_body['fail_url'] = "your fail url";
    post_body['cancel_url'] = "https://guarded-bastion-31565.herokuapp.com/cancel";
    post_body['emi_option'] = 0;
    post_body['cus_name'] = data.name;
    post_body['cus_email'] = data.email;
    post_body['cus_phone'] = data.shipment.phone;
    post_body['cus_add1'] = data.shipment.address;
    post_body['cus_city'] = "";
    post_body['cus_country'] = "Bangladesh";
    post_body['shipping_method'] = "NO";
    post_body['multi_card_name'] = ""
    post_body['num_of_item'] = '';
    post_body['product_name'] = "Test";
    post_body['product_category'] = "Test Category";
    post_body['product_profile'] = data.products;

    // console.log(post_body)


    sslcommerz.init_transaction(post_body)
      .then(response => {
        res.send(response)
      })
      .catch(error => {
        console.log(error);
      })    
  })


  app.post('/success', (req, res) => {
    const val_id = req.body.val_id;
    const card_type = req.body.card_type;
    const bank_tran_id = req.body.bank_tran_id;
    const tran_date = req.body.tran_date;
    const card_no = req.body.card_no;
    // console.log(bank_tran_id, tran_date, val_id, card_type, card_no)    
    orders['paymentId'] = bank_tran_id
    // console.log(orders)
    ordersCollection.insertOne(orders)
      .then(result => {
        // console.log(result.insertedCount > 0)
        if(result.insertedCount > 0){
          orders = null;
          res.redirect("https://dailyneeds-6ea60.web.app/success")
        }
        
      })
    
  })
});

app.listen(process.env.PORT || port)