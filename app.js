const express =require('expressq');
const path =require('path');
const fs =require('fs');
const bs =require('./blockchain.js');
const MongoClient= require('mongodb').MongoClient;
const bodyParser =require('bocy-parser');


const prot=8000;
const app= express();

const BChain=new bs.BlockChain();
BChain. addBlock({sender: "Customer-A", reciver: "Supplier-4" , amount: 100});
BChain. addBlock({sender: "OEM-7", reciver: "Customer-B", invoice: '908987897'});
BChain. addBlock({sender: "Tests", reciver:"Customer-A", amount: 75});


 //To store the Blockchain on a file
 const chain_path = path. resolve (_dirname, "..","./data/chain.json");
 const data_path= path.resolve(_dirname,"..",'./data/');

 if (Ifs.existsSync (data_path)){
    fs.mkdirSync(data_path);
        }
BChain.storeChain(chain_path);

// To load the blockchain form the file

BChainFromFile = bs. loadChain(chain_path);

// console. log(BChain.chainIsValid());
// console. log(BChainFromFile.chainIsValid());
//console.log (BChain);
// console. log (BChainFromFile);
//default route

app.get (' /' , (req, res)=>{
res.send('Hello World');
});

// get the whole chain
app.get ('/api/getChain', (req, res)=>{
    res.send(JSON.stringify (BChainFromFile.chain));
});

// get a unique block by id

app.get ('/api/getblock',(req, res)=>{
    let id = req.query. id;
    console. log(id);
    res.send(JSON.stringify(BChainFromFile.getBlockByID(id)));
});