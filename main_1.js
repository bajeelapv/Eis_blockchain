'use strict';
const EC = require("elliptic").ec; // for generating public and private key; for saign and validate
const ec = new EC("secp256k1");

const {BlockChain,Transactions}= require("./blockchain");

const myKey= ec.keyFromPrivate("965da3a895d29c915c0197e9329ca332addcc26d56cea05e396ab89380f7f62e");
const myWalletAddress= myKey.getPublic("hex");


let bc = new BlockChain()

const tx1=new Transactions(myWalletAddress,"public key"," hello ");
tx1.signTransaction(myKey);
bc.addTransaction(tx1)
const tx2 = new Transactions(myWalletAddress, "ad2", 500)
tx2.signTransaction(myKey)
 bc.addTransaction(tx2);



//bc.createTransaction(new Transactions("ad2", "ad1", 400));

console.log(JSON.stringify(bc, null, 4))


console.log("Is blockchain valid  " + bc.isChainValid() );
