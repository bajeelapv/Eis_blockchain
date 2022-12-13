'use strict';
const crypto = require('crypto');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const debug = require('debug')('savjeecoin:blockchain');

class Transaction {
  /**
   * @param {string} fromAddress
   * @param {string} toAddress
   * @param {number} amount
   */
  constructor(fromAddress, toAddress, amount) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = Date.now();
  }

  /**
   * Creates a SHA256 hash of the transaction
   *
   * @returns {string}
   */
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
      .digest('hex');
  }

  /**
   * Signs a transaction with the given signingKey (which is an Elliptic keypair
   * object that contains a private key). The signature is then stored inside the
   * transaction object and later stored on the blockchain.
   *
   * @param {string} signingKey
   */
  signTransaction(signingKey) {
    // You can only send a transaction from the wallet that is linked to your
    // key. So here we check if the fromAddress matches your publicKey
    if (signingKey.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets!');
    }

    // Calculate the hash of this transaction, sign it with the key
    // and store it inside the transaction object
    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, 'base64');

    this.signature = sig.toDER('hex');
  }

  /**
   * Checks if the signature is valid (transaction has not been tampered with).
   * It uses the fromAddress as the public key.
   *
   * @returns {boolean}
   */
  isValid() {
    // If the transaction doesn't have a from address we assume it's a
    // mining reward and that it's valid. You could verify this in a
    // different way (special field for instance)
    if (this.fromAddress === null) return true;

    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }

    const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
    return publicKey.verify(this.calculateHash(), this.signature);
  }
}

class Block {
  /**
   * @param {number} timestamp
   * @param {Transaction[]} transactions
   * @param {string} previousHash
   */
  constructor(timestamp, transactions, previousHash = '') {
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  /**
   * Returns the SHA256 of this block (by processing all the data stored
   * inside this block)
   *
   * @returns {string}
   */
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.previousHash +
          this.timestamp +
          JSON.stringify(this.transactions) +
          this.nonce
      )
      .digest('hex');
  }

  /**
   * Starts the mining process on the block. It changes the 'nonce' until the hash
   * of the block starts with enough zeros (= difficulty)
   *
   * @param {number} difficulty
   */
  mineBlock(difficulty) {
    while (
      this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')
    ) {
      this.nonce++;
      this.hash = this.calculateHash();
    }

    debug(`Block mined: ${this.hash}`);
  }

  /**
   * Validates all the transactions inside this block (signature + hash) and
   * returns true if everything checks out. False if the block is invalid.
   *
   * @returns {boolean}
   */
  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (!tx.isValid()) {
        return false;
      }
    }

    return true;
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.pendingTransactions = [];
    this.miningReward = 100;
  }

  /**
   * @returns {Block}
   */
  createGenesisBlock() {
    return new Block(Date.parse('2017-01-01'), [], '0');
  }

  /**
   * Returns the latest block on our chain. Useful when you want to create a
   * new Block and you need the hash of the previous Block.
   *
   * @returns {Block[]}
   */
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Takes all the pending transactions, puts them in a Block and starts the
   * mining process. It also adds a transaction to send the mining reward to
   * the given address.
   *
   * @param {string} miningRewardAddress
   */
  minePendingTransactions(miningRewardAddress) {
    const rewardTx = new Transaction(
      null,
      miningRewardAddress,
      this.miningReward
    );
    this.pendingTransactions.push(rewardTx);

    const block = new Block(
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    block.mineBlock(this.difficulty);

    debug('Block successfully mined!');
    this.chain.push(block);

    this.pendingTransactions = [];
  }

  /**
   * Add a new transaction to the list of pending transactions (to be added
   * next time the mining process starts). This verifies that the given
   * transaction is properly signed.
   *
   * @param {Transaction} transaction
   */
  addTransaction(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('Transaction must include from and to address');
    }

    // Verify the transactiion
    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to chain');
    }

    if (transaction.amount <= 0) {
      throw new Error('Transaction amount should be higher than 0');
    }

    // Making sure that the amount sent is not greater than existing balance
    const walletBalance = this.getBalanceOfAddress(transaction.fromAddress);
    if (walletBalance < transaction.amount) {
      throw new Error('Not enough balance');
    }

    // Get all other pending transactions for the "from" wallet
    const pendingTxForWallet = this.pendingTransactions.filter(
      tx => tx.fromAddress === transaction.fromAddress
    );

    // If the wallet has more pending transactions, calculate the total amount
    // of spend coins so far. If this exceeds the balance, we refuse to add this
    // transaction.
    if (pendingTxForWallet.length > 0) {
      const totalPendingAmount = pendingTxForWallet
        .map(tx => tx.amount)
        .reduce((prev, curr) => prev + curr);

      const totalAmount = totalPendingAmount + transaction.amount;
      if (totalAmount > walletBalance) {
        throw new Error(
          'Pending transactions for this wallet is higher than its balance.'
        );
      }
    }

    this.pendingTransactions.push(transaction);
    debug('transaction added: %s', transaction);
  }

  /**
   * Returns the balance of a given wallet address.
   *
   * @param {string} address
   * @returns {number} The balance of the wallet
   */
  getBalanceOfAddress(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= trans.amount;
        }

        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    debug('getBalanceOfAdrees: %s', balance);
    return balance;
  }

  /**
   * Returns a list of all transactions that happened
   * to and from the given wallet address.
   *
   * @param  {string} address
   * @return {Transaction[]}
   */
  getAllTransactionsForWallet(address) {
    const txs = [];

    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address || tx.toAddress === address) {
          txs.push(tx);
        }
      }
    }

    debug('get transactions for wallet count: %s', txs.length);
    return txs;
  }

  /**
   * Loops over all the blocks in the chain and verify if they are properly
   * linked together and nobody has tampered with the hashes. By checking
   * the blocks it also verifies the (signed) transactions inside of them.
   *
   * @returns {boolean}
   */
  isChainValid() {
    // Check if the Genesis block hasn't been tampered with by comparing
    // the output of createGenesisBlock with the first block on our chain
    const realGenesis = JSON.stringify(this.createGenesisBlock());

    if (realGenesis !== JSON.stringify(this.chain[0])) {
      return false;
    }

    // Check the remaining blocks on the chain to see if there hashes and
    // signatures are correct
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (previousBlock.hash !== currentBlock.previousHash) {
        return false;
      }

      if (!currentBlock.hasValidTransactions()) {
        return false;
      }

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }
    }

    return true;
  }
}

module.exports.Blockchain = Blockchain;
module.exports.Block = Block;
module.exports.Transaction = Transaction;



/////////////////////////////////////////////////////////////////////////////







// const crypto = require("crypto");//('crypto-js/sha256')
// const EC = require("elliptic").ec; // for generating public and private key; for saign and validate
// const ec = new EC("secp256k1");
// const debug = require('debug')('bc:blockchain');
// const { SHA256 } = require("crypto-js");
// class Transactions{
//     constructor(fromAddress, toAddress, amount){
//         this.fromAddress= fromAddress;
//         this.toAddress=  toAddress;
//         this.amount=  amount
//     }
//     calculateHash(){
//         return SHA256(this.fromAddress+ this.toAddress +this.amount).toString();
//     }
//     signTransaction(signingKey){
//         if (signingKey.getPublic("hex") !== this.fromAddress){
//             throw new Error("You can not sign transaction for other wallets");
//         }
//         const hashtx= this.calculateHash();
//         const sig = signingKey.sign(hashtx, "base64");
//         this.signature=sig.toDER("hex");

//     }
//     isValid(){
//         if(!this.signature || this.signature.length== 0){
//             throw new Error("No signature in this transaction");
            
//         }
//         const publickey = ec.keyFromPublic(this.fromAddress, "hex")
//         return publickey.verify(this.calculateHash(), this.signature);
//     }
// }
// class Block {
//     constructor(index, timestamp, transactions, prevHash, hash) {


//         this.index = index;
        
//         //if the timestamp is undefined, we need to get  the system time
//         if (timestamp === undefined) this.timestamp = Math.floor(Date.now() / 1000); else this.timestamp = timestamp;
        
  
//         this.transactions = transactions;
//         this.prevHash = prevHash;
        
//         if (hash === undefined) this.hash = this.calculateHash(); else this.hash = hash;
//     }

//     calculateHash() {
//         let encript = JSON.stringify(this.transactions) + this.prevHash + this.index + this.timestamp;
        
      
//         let hash = crypto.createHmac('sha256', "secret")
//             .update(encript)
//             .digest('hex');
//         // return crypto(JSON.stringify(this.data) + this.prevHash + this.index + this.timestamp);
//         return hash;
//     }
//     hasValidTransactions(){
//         for(const tx of this.transactions){
//             if(!tx.isValid()){
//                 return false;

//             }
//         }
//         return true;
//     }
// }
// class BlockChain{
//     constructor(){

//         this.chain=[this.createGenesisBlock()];
//         this.pendingTransactions=[]
//     }
//     // addTransaction(transactions){
        
//     //     let index = this.chain.length;
//     //     let prevHash = this.chain.length !== 0 ? this.chain[this.chain.length - 1].hash : 0;
//     //     let block= new Block(index, Date.now(),transactions,prevHash);
//     //     if(!transactions.fromAddress  || !transactions.toAddress){
//     //         throw new Error("Transaction must include from and to address");
//     //     }
//     //     if(!transactions.isValid()){
//     //         throw new Error("Can not add invalid transaction to blockchain");
//     //     }
//     //     this.chain.push(block);
        
        
//     // }
//     PendingTransactions(miningRewardAddress) {
//         // const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward);
//         // this.pendingTransactions.push(rewardTx);
//         let index = this.chain.length;
//         let prevHash = this.chain.length !== 0 ? this.chain[this.chain.length - 1].hash : 0;
//         const block = new Block(index, Date.now(), this.pendingTransactions, prevHash);
//         //block.mineBlock(this.difficulty);
    
//         //debug('Block successfully mined!');
//         this.chain.push(block);
    
//         this.pendingTransactions = [];
//       }

//     addTransaction(transaction) {
//     if (!transaction.fromAddress || !transaction.toAddress) {
//       throw new Error('Transaction must include from and to address');
//     }

//     // Verify the transactiion
//     if (!transaction.isValid()) {
//       throw new Error('Cannot add invalid transaction to chain');
//     }
    
//     // if (transaction.amount <= 0) {
//     //   throw new Error('Transaction amount should be higher than 0');
//     // }
    
//     // // Making sure that the amount sent is not greater than existing balance
//     // if (this.getBalanceOfAddress(transaction.fromAddress) < transaction.amount) {
//     //   throw new Error('Not enough balance');
//     // }

//     this.pendingTransactions.push(transaction);
//     debug('transaction added: %s', transaction);
//   }

    
//     createGenesisBlock(){
//         return(new Block(0,"01/01/2022","Genesis Block", "0"));
//     }
//     getLatestBlock(){
//         return this.chain(this.chain.length-1);
//     }
  
//     // to check the validity of the chain
//     isChainValid() {
//        // Check if the Genesis block hasn't been tampered with by comparing
//     // the output of createGenesisBlock with the first block on our chain
//     const realGenesis = JSON.stringify(this.createGenesisBlock());

//     if (realGenesis !== JSON.stringify(this.chain[0])) {
//       return false;
//     }

//     // Check the remaining blocks on the chain to see if there hashes and signatures are correct
//     for (let i = 1; i < this.chain.length; i++) {
//       const currentBlock = this.chain[i];
//       const previousBlock = this.chain[i - 1];
//       if (!currentBlock.hasValidTransactions()) {
        
//         return false;
//       }
//       if (previousBlock.hash !== currentBlock.prevHash) {
        
//         return false;
//       }

      

//       if (currentBlock.hash !== currentBlock.calculateHash()) {
        
//         return false;
//       }
//     }

//     return true;
  
//     }
// }
// module.exports.BlockChain=BlockChain;
// module.exports.Transactions=Transactions;