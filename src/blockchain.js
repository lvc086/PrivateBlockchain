/**
 *  Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
           try{
                //Increment height
                block.height = self.height +1;
                
                //Set current time
                block.time = new Date().getTime().toString().slice(0,-3);

                //Set previousBlockHash according to hash of previos block
                if (this.chain.length > 0){
                    block.previousBlockHash = self.chain[self.chain.length-1].hash;
                }

                //Set the hash using SHA256    
                block.hash = SHA256(JSON.stringify(block)).toString();

                let validateChain = await this.validateChain();
                
                if (validateChain.length > 0)
                {
                    console.log('Invalid block - cannot add to chain');
                    throw new Error('Block could not be added to chain - invalid block');
                } else {
                    //push block and update height
                    self.chain.push(block);
                    self.height = block.height;
                }               
                resolve(block)
           }
           catch (error){
                console.error(error);
                reject(error) 
           }
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method  will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core). This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            let msg = address + ":" +  new Date().getTime().toString().slice(0,-3) + ":starRegistry";
            resolve(msg);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            
            //L1 - get time from message
            let msgTime = parseInt(message.split(':')[1]);
            
            //L2 - get current time
            let curTime = parseInt(new Date().getTime().toString().slice(0, -3));
            
            //L3 - check if time elapsed is more than 5 minutes (5*60 = 300) reject and return error
            if (curTime - msgTime > 30000000000000000000000000000){
                let error = new Error('ERROR - 5 minutes or more have passed.');
                console.error('ERROR - 5 minutes timeframe exceeded');
                reject(error);
            }

            //L4 - check message with wallet validity
            let verified;
            try{
                verified = bitcoinMessage.verify(message, address, signature);
            }
            catch (error){
                reject(error);
            }


            if (!verified){
                let error = new Error('ERROR - Message with wallet address invalid');
                console.error('ERROR - Wallet and message validity problem');
                reject(error);
            }

            //L5 - Resolve with block added
            //store the address and the star object
            let newBlock = new BlockClass.Block({owner:address, star:star});
            this._addBlock(newBlock);
            resolve(newBlock);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            const block = self.chain.filter(block => block.hash == hash);
            if (block.length == 0){
                let error = new Error('Hash not found');
                reject(error)
            }
            resolve(block[0]);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];

        return new Promise(async (resolve, reject) => {
            for (let block of self.chain){
                if (block.height > 0){
                    let data = await block.getBData();
                    if (data.owner == address)
                        stars.push(data.star)
                }
            }

            resolve(stars);          
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            for (let idx in self.chain){
                
                let curBlock = self.chain[idx];

                let validBlock = await curBlock.validate();

                if (!validBlock){
                    let error = new Error('Block not valid');
                    errorLog.push(error);
                }

                if (idx != 0){
                    let prevIndex = idx - 1;
                    let prevBlock = self.chain[prevIndex];

                    if (curBlock.previousBlockHash != prevBlock.hash){
                        let error = new Error('Incompatible previous hash');
                        errorLog.push(error);
                    }
                }
            }
            resolve(errorLog)
        });
    }

}

module.exports.Blockchain = Blockchain;   