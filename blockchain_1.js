const crypto = require('crypto'); // library for cryptography to use hashing fn
const fs = require('fs'); //library for filesystem to store files

//javascript  for nodjs framework. this is serverside



// The block class is the barebone of the BlockChain

// the two if statements are just for the case of reloading the chain (not to overwrite the timestmps etc ..)

class Block {
    constructor(index, data, prevHash, timestamp, hash) {


        this.index = index;
        //if the timestamp is undefined, we need to get  the system time
        if (timestamp === undefined) this.timestamp = Math.floor(Date.now() / 1000); else this.timestamp = timestamp;
        this.data = data;
        this.prevHash = prevHash;
        if (hash === undefined) this.hash = this.getHash(); else this.hash = hash;
        this.nonce=0;
    }

    getHash() {
        let encript = JSON.stringify(this.data) + this.prevHash + this.index + this.timestamp+this.nonce;
        let hash = crypto.createHmac('sha256', "secret")
            .update(encript)
            .digest('hex');
        // return sha(JSON.stringify(this.data) + this.prevHash + this.index + this.timestamp);
        return hash;
    }
    mineBlock(difficulty){
        while(this.hash.substring(0, difficulty)!== Array(difficulty+1).join(0)){
            this.nonce++;
            this.hash=this.getHash();
        }
        console.log("block mined" +this.hash);
    }
}


class BlockChain {

//the constructor is overloaded to enable loading JSON encoded blockchains !!
    constructor() {
        if (arguments.length > 0) {
            Object.assign(this, arguments[0]);
            for (let i = 0; i < this.chain.length; i++) {
                this.chain[i] = new Block(this.chain[i].index, this.chain[i].data, this.chain[i].prevHash, this.chain[i].timestamp, this.chain[i].hash);

            }
        } else {
            this.chain = [];
        }
    }


    addBlock(data) {
        try {
            let index = this.chain.length;
            let prevHash = this.chain.length !== 0 ? this.chain[this.chain.length - 1].hash : 0;
            let block = new Block(index, data, prevHash);
            this.chain.push(block);
        } catch (e) {
            return e;
        }
    }


// to check the validity of the chain
    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];
      
            if (previousBlock.hash !== currentBlock.previousHash) {
              return false;
            }
      
            // if (!currentBlock.hasValidTransactions()) {
            //   return false;
            // }
      
            if (currentBlock.hash !== currentBlock.getHash()) {
                return false;
            }
          }







        // for (let i = 0; i < this.chain.length; i++) {
        //     if (this.chain[i].hash !== this.chain[i].getHash()){
        //         console.log("Data was tampered with")
        //         return false;}
        //     if (i > 0 && this.chain[i].prevHash !== this.chain[i - 1].hash){
        //         console.log("Blocks were tampered with " + i)

        //         return false;}
        // }
        // return true;
    }

// to get a block by its ID

    getBlockByID(id) {
        for (let i = 0; i < this.chain.length; i++) {
            if (this.chain[i].index == id)
                return this.chain[i];
        }

    }

// to get a block by its type
    async getBlockByType(type) {

        try {
            let blocks = await this.getChain();
            return blocks.filter(blocks => blocks.data.type == type);

        } catch (e) {
            return e;
        }


    }




    getChain() {

        return this.chain;

    }

// to store the chain in the path
    storeChain(path) {
        console.log("Storing")
        let str = JSON.stringify(this);
        fs.writeFileSync(path, str);
    }
}


// a static function to load the blockchain from a json file
function loadChain(path) {

    let str = fs.readFileSync(path)
    var BChain2;
    try {
        let obj = JSON.parse(str);
         BChain2 = new BlockChain(obj);

    } catch (e) {
         BChain2 = new BlockChain();

    }
   return BChain2

}


module.exports = {
    Block: Block,
    BlockChain: BlockChain,
    loadChain: loadChain

};


let bc = new BlockChain()
bc.addBlock(" ");

bc.addBlock({amount: 10});


console.log(JSON.stringify(bc, null, 4))

console.log(200+20000)
bc.chain[1].data={amount : 1022};

console.log("Is blockchain valid" + bc.isChainValid() );