let Web3 = require('web3');
let express = require('express');
let ejs = require('ejs');
let mysql = require('mysql');

let config = require("./config");

let app = express()

let myAddress = "0xfbdaf3c38ca028e6c5ec40c7f92bcc06f6f38dbb";
let USER_SHARE = 0.50; //50%
let DIVIDENT_SHARE = 0.20; //SHARE
let MASTER_NODE_REWARD = 0.35; //7% of 20% (7 / 20) = 0.35

let MIN_WIDTHDRAW = 0.006;

let next_buysell_update = Date.now();

app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

var ab = [{"constant":true,"inputs":[{"name":"_customerAddress","type":"address"}],"name":"dividendsOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_ethereumToSpend","type":"uint256"}],"name":"calculateTokensReceived","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_tokensToSell","type":"uint256"}],"name":"calculateEthereumReceived","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"sellPrice","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"stakingRequirement","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_includeReferralBonus","type":"bool"}],"name":"myDividends","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalEthereumBalance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_customerAddress","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"buyPrice","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"myTokens","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_toAddress","type":"address"},{"name":"_amountOfTokens","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_amountOfTokens","type":"uint256"}],"name":"sell","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"exit","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_referredBy","type":"address"}],"name":"buy","outputs":[{"name":"","type":"uint256"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"reinvest","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"customerAddress","type":"address"},{"indexed":false,"name":"incomingEthereum","type":"uint256"},{"indexed":false,"name":"tokensMinted","type":"uint256"},{"indexed":true,"name":"referredBy","type":"address"},{"indexed":false,"name":"timestamp","type":"uint256"},{"indexed":false,"name":"price","type":"uint256"}],"name":"onTokenPurchase","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"customerAddress","type":"address"},{"indexed":false,"name":"tokensBurned","type":"uint256"},{"indexed":false,"name":"ethereumEarned","type":"uint256"},{"indexed":false,"name":"timestamp","type":"uint256"},{"indexed":false,"name":"price","type":"uint256"}],"name":"onTokenSell","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"customerAddress","type":"address"},{"indexed":false,"name":"ethereumReinvested","type":"uint256"},{"indexed":false,"name":"tokensMinted","type":"uint256"}],"name":"onReinvestment","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"customerAddress","type":"address"},{"indexed":false,"name":"ethereumWithdrawn","type":"uint256"}],"name":"onWithdraw","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"tokens","type":"uint256"}],"name":"Transfer","type":"event"}];
var contract = "0xC28E860C9132D55A184F9af53FC85e90Aa3A0153";

let POTJ_TOKEN = {buy: "", sell: ""};

const provider = new Web3.providers.WebsocketProvider("ws://localhost:8546")

provider.on('error', e => console.error('WS Error', e));
provider.on('end', e => console.error('WS End', e));

web3 = new Web3(provider);

let db = mysql.createConnection({
    host: "localhost",
    user: config.db_user,
    password: config.db_pass,
    database:config.db_database
});

db.connect((err) => {
    if(err) throw err;
    console.log("Database Connected");
    db.query("SELECT * FROM stats WHERE id = 1", (err, result, fields) => {
        let last_block =  result[0].last_block;
        op = initContract(ab, contract, last_block);
    });
});

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function (req, res) {
    console.log("Someone Looked at the website");
    res.render('index', {minimum: MIN_WIDTHDRAW});
})

app.get('/info/:address', (req, res) => {
   
    let address_ = req.params.address;

    let sql = "SELECT SUM(share) as sum_share, SUM(claimed) as sum_claimed, SUM(claim_pending) as pending FROM users WHERE address = '" + address_ + "'";

    db.query(sql, (err, result, fields) => {
        if(err) return;

        let user_data = {
            address: address_,
            balance: result[0].sum_share - result[0].sum_claimed,
            claimed: result[0].sum_claimed,
            claim_pending: result[0].pending
        };
        res.send(user_data); 
    });
});

app.get('/stats', (req, res) => {
    let sql = "SELECT SUM(share) as total_shares, COUNT(DISTINCT address) as address_count FROM users";
    db.query(sql, (err, response, fields) => {
        if(err) return;
        
        let stat_data = {
            user_count: response[0].address_count,
            total_shares: response[0].total_shares,
            potj_buy: + POTJ_TOKEN.buyPrice,
            potj_sell: + POTJ_TOKEN.sellPrice
        }

        res.send(stat_data);
    });
})

app.get('/withdraw/:address', (req, res) => {
    let address = req.params.address;

    let sql = "SELECT SUM(share) as total_shares, SUM(claimed) as total_claimed FROM users WHERE address = '" + address + "'";

    db.query(sql, (err, result, f) => {
        if(err) return;
        let total_share = result[0].total_shares - result[0].total_claimed;

        if(total_share >= MIN_WIDTHDRAW) {
            //save to database
            db.query("UPDATE users SET claim_pending = 1 WHERE address = '" + address + "'", (err, result, f) => {
                res.send({success: true});
            });
        }
        else {
            //return no go
            res.send({success: false})
        }
    });
})

app.listen(config.webserver, () => console.log('Example app listening on port ' + config.webserver ));

function update_buysell_price(contract) {

    if(next_buysell_update > Date.now()) return;

    console.log("updating stats");

    contract.methods.sellPrice().call().then((r) => {
        POTJ_TOKEN.sellPrice = Number(r / 1e18).toFixed(6);
    }).catch(e => {
        console.log(e);
    });

    contract.methods.buyPrice().call().then((r) => {
        POTJ_TOKEN.buyPrice = Number(r / 1e18).toFixed(6);
    }).catch(e => {
        console.log(e);
    });

    next_buysell_update += 60 * 1000;
}

function initContract(ab, contract, from_block) {
    var MyContract = new web3.eth.Contract(ab, contract);
    var contractInstance = MyContract.events;

    update_buysell_price(MyContract);

    console.log("listening for events on ", contract);

    web3.eth.getBlockNumber((error, res) => {
        if(error) {
            console.log("ERROR" + error);
            return;
        }
        console.log(res);

        update_buysell_price(MyContract);

        MyContract.events.allEvents({fromBlock: from_block + 1}, (err, r) => {
            console.log(err);
        }).on("data", (data) => {
            //console.log(data);
            console.log(data.event);
            //console.log(data.blockNumber);
            if(data.event != "onTokenPurchase") return;
            let tx = data.transactionHash;
            let ref = data.returnValues.referredBy;
            let user = data.returnValues.customerAddress;
            let block = data.blockNumber;
            let eth = data.returnValues.incomingEthereum / 1e18;
            let tokens = data.returnValues.tokensMinted / 1e18;

            //if(block <= from_block) return;

            let master_reward = (eth * DIVIDENT_SHARE) * MASTER_NODE_REWARD;
            let user_share = master_reward * USER_SHARE;

            //console.log(data);
            //update_buysell_price(MyContract);

            let clients = [];

            console.log("Referred By: " + ref);
            if(myAddress === ref) {
                console.log(tokens);
                console.log("User " + user + " Got tokens You are a referrer");
                clients.push([tx, user, tokens, eth, user_share]);
            }
            else {
                db.query("UPDATE stats SET last_block = " + block + " WHERE id = 1", (err, result) => {
                    if(err) throw err;
                });
            }

            if(clients.length == 0) return;

            db.query("INSERT IGNORE INTO users (tx, address, tokens, eth, share) VALUES ?", [clients], (err, result) => {
                //if(err) throw err;
                db.query("UPDATE stats SET last_block = " + block + " WHERE id = 1", (err, result)=>{
                    //if(err) throw err;
                });
            });
            //push data to db
        }).on("error", err => {
            console.log(err);
        });
    });

    return contractInstance
  }
