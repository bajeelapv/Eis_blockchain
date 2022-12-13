'use strict';
const crypto = require("crypto");//('crypto-js/sha256')
const EC = require("elliptic").ec; // for generating public and private key; for saign and validate
const ec = new EC("secp256k1");
const debug = require('debug')('bc:blockchain');
const { SHA256 } = require("crypto-js");
class Transactions{
    constructor(fromAddress, toAddress, amount){
        this.fromAddress= fromAddress;
        this.toAddress=  toAddress;
        this.amount=  amount
    }
    calculateHash(){
        return SHA256(this.fromAddress+ this.toAddress +this.amount).toString();
    }
    signTransaction(signingKey){
        if (signingKey.getPublic("hex") !== this.fromAddress){
            throw new Error("You can not sign transaction for other wallets");
        }
        const hashtx= this.calculateHash();
        const sig = signingKey.sign(hashtx, "base64");
        this.signature=sig.toDER("hex");

    }
    isValid(){
        if(!this.signature || this.signature.length== 0){
            throw new Error("No signature in this transaction");
            
        }
        const publickey = ec.keyFromPublic(this.fromAddress, "hex")
        return publickey.verify(this.calculateHash(), this.signature);
    }
}
class Block {
    constructor(index, timestamp, transactions, prevHash, hash) {


        this.index = index;
        
        //if the timestamp is undefined, we need to get  the system time
        if (timestamp === undefined) this.timestamp = Math.floor(Date.now() / 1000); else this.timestamp = timestamp;
        
  
        this.transactions = transactions;
        this.prevHash = prevHash;
        
        if (hash === undefined) this.hash = this.calculateHash(); else this.hash = hash;
    }

    calculateHash() {
        let encript = JSON.stringify(this.transactions) + this.prevHash + this.index + this.timestamp;
        
      
        let hash = crypto.createHmac('sha256', "secret")
            .update(encript)
            .digest('hex');
        // return crypto(JSON.stringify(this.data) + this.prevHash + this.index + this.timestamp);
        return hash;
    }
    hasValidTransactions(){
        for(const tx of this.transactions){
            if(!tx.isValid()){
                return false;

            }
        }
        return true;
    }
}
class BlockChain{
    constructor(){

        this.chain=[this.createGenesisBlock()];
        this.pendingTransactions=[]
    }
    // addTransaction(transactions){
        
    //     let index = this.chain.length;
    //     let prevHash = this.chain.length !== 0 ? this.chain[this.chain.length - 1].hash : 0;
    //     let block= new Block(index, Date.now(),transactions,prevHash);
    //     if(!transactions.fromAddress  || !transactions.toAddress){
    //         throw new Error("Transaction must include from and to address");
    //     }
    //     if(!transactions.isValid()){
    //         throw new Error("Can not add invalid transaction to blockchain");
    //     }
    //     this.chain.push(block);
        
        
    // }
    PendingTransactions(miningRewardAddress) {
        // const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward);
        // this.pendingTransactions.push(rewardTx);
        let index = this.chain.length;
        let prevHash = this.chain.length !== 0 ? this.chain[this.chain.length - 1].hash : 0;
        const block = new Block(index, Date.now(), this.pendingTransactions, prevHash);
        //block.mineBlock(this.difficulty);
    
        //debug('Block successfully mined!');
        this.chain.push(block);
    
        this.pendingTransactions = [];
      }

    addTransaction(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('Transaction must include from and to address');
    }

    // Verify the transactiion
    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to chain');
    }
    
    // if (transaction.amount <= 0) {
    //   throw new Error('Transaction amount should be higher than 0');
    // }
    
    // // Making sure that the amount sent is not greater than existing balance
    // if (this.getBalanceOfAddress(transaction.fromAddress) < transaction.amount) {
    //   throw new Error('Not enough balance');
    // }

    this.pendingTransactions.push(transaction);
    debug('transaction added: %s', transaction);
  }

    
    createGenesisBlock(){
        return(new Block(0,"01/01/2022","Genesis Block", "0"));
    }
    getLatestBlock(){
        return this.chain(this.chain.length-1);
    }
  
    // to check the validity of the chain
    isChainValid() {
       // Check if the Genesis block hasn't been tampered with by comparing
    // the output of createGenesisBlock with the first block on our chain
    const realGenesis = JSON.stringify(this.createGenesisBlock());

    if (realGenesis !== JSON.stringify(this.chain[0])) {
      return false;
    }

    // Check the remaining blocks on the chain to see if there hashes and signatures are correct
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      if (!currentBlock.hasValidTransactions()) {
        
        return false;
      }
      if (previousBlock.hash !== currentBlock.prevHash) {
        
        return false;
      }

      

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        
        return false;
      }
    }

    return true;
  
    }
}
module.exports.BlockChain=BlockChain;
module.exports.Transactions=Transactions;
