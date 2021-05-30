let api_key;
let secret;
//specify api key
const https = require('https');
const axios = require('axios');
const qs = require('qs');
const moment = require('moment');
const crypto = require('crypto');
const endpoint = 'https://api.binance.com';
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
let priceList = {};
let options = {
    method: 'GET',
    // data: qs.stringify(data),
};
const prompt = require('prompt');

//
// Start the prompt
//
// prompt.start();

//
// Get two properties from the user: username and email
//
// prompt.get(['api_key', 'secret'], function (err, result) {
//     console.log('Command-line input received:');
//     console.log('  api_key: ' + result.api_key);
//     console.log('  secret: ' + result.secret);
//     api_key = result.api_key
//     secret = result.secret
//     options.headers = {
//         'content-type': 'application/json',
//         'X-MBX-APIKEY': api_key
//     }
//     main();
//
// });

async function getCoinList(query_string) {
    let time = await getServerTime();
    let data = {
        'timestamp': time.serverTime,
        'recvWindow': 60000
    };
    data.signature = crypto.createHmac('sha256', secret).update(qs.stringify(data)).digest().toString('hex');
    let querystring = qs.stringify(data)
    options.url = endpoint + '/sapi/v1/capital/config/getall' + '?' + querystring;
    try {
        let result = await axios(options);
        result.data.forEach(v => {
            console.log(v.coin)
        })
        console.log(result.data);
    } catch (e) {
        console.error(e)
    }
}

async function getAcc() {
    let time = await getServerTime();
    let data = {
        'timestamp': time.serverTime,
        'recvWindow': 60000
    };
    let coinList = [];
    data.signature = crypto.createHmac('sha256', secret).update(qs.stringify(data)).digest().toString('hex');
    let querystring = qs.stringify(data)
    options.url = endpoint + '/api/v3/account' + '?' + querystring;
    try {
        console.log(options)
        let result = await axios(options);
        // console.log(result.data)
        for await (let v of result.data.balances) {
            if (parseFloat(v.free) > 0 || parseFloat(v.locked) > 0) {
                console.log(v)
                priceList[`${v.asset}USDT`] = await queryLatestPrice(`${v.asset}USDT`)
                coinList.push(v)
            }
        }
        return coinList;
        // console.log(result.data);
    } catch (e) {
        // console.error(e)
    }
}

async function getServerTime() {
    options.url = endpoint + '/api/v3/time';
    try {
        let result = await axios(options);
        return result.data
    } catch (e) {
        console.error(e)
    }
}

async function getTrade(symbol, test) {
    if (symbol === 'USDT') {
        return [];
    }
    let time = await getServerTime();
    let data = {
        'symbol': `${symbol}USDT`,
        'timestamp': time.serverTime,
        'recvWindow': 60000
    };
    data.signature = crypto.createHmac('sha256', secret).update(qs.stringify(data)).digest().toString('hex');
    let querystring = qs.stringify(data)
    options.url = endpoint + '/api/v3/myTrades' + '?' + querystring;
    try {
        let result = await axios(options);
        console.log(result.data)
        return result.data
    } catch (e) {
        console.error(e)
    }

}

async function queryLatestPrice(symbol) {
    // let time = await getServerTime();
    let data = {
        'symbol': symbol,
    };
    let querystring = qs.stringify(data)
    options.url = endpoint + '/api/v3/ticker/price' + '?' + querystring;
    try {
        let result = await axios(options);
        console.log(result.data)
        return result.data.price;
    } catch (e) {
        console.error(e)
    }
}

async function main() {
    let coinList = await getAcc();
    let tradeList = [];
    for await (let v of coinList) {
    // console.log(v.asset)
    let trade = await getTrade(v.asset);
    tradeList = tradeList.concat(trade)
    }
    const csvWriter = createCsvWriter({
        path: 'report.csv',
        header: [
            {id: 'time', title: 'Time'},
            {id: 'coin', title: 'Coin'},
            {id: 'action', title: 'Buy/Sell'},
            {id: 'bPrice', title: 'Price'},
            {id: 'bQty', title: 'QTY'},
            {id: 'coinPrice', title: 'Current Coin Price(USDT)'},
            {id: 'invested', title: 'Invest(USDT)'},
            {id: 'margin', title: 'Margin(USDT)'},
        ]
    });
    let records = [];
    for await (let v of tradeList) {
        if (v) {
            let obj = {};
            let latestPrice = getLatestPrice(v.symbol)
            obj['coin'] = v.symbol;
            obj['bPrice'] = v.price;
            obj['bQty'] = v.qty;
            obj['action'] = v.isBuyer ? 'BUY' : 'SELL';
            obj['coinPrice'] = latestPrice;
            obj['invested'] = v.quoteQty;
            obj['margin'] = ((parseFloat(latestPrice) * parseFloat(v.qty)) - parseFloat(v.quoteQty));
            obj['time'] = moment(v.time).format('DD/MM/YYYY hh:mm:ss');
            // records += `${v}`
            records.push(obj);
        }
    }
    csvWriter.writeRecords(records)       // returns a promise
        .then(() => {
            console.log('...Done');
        });

    console.log(tradeList)
}

function getLatestPrice(symbol) {
    return priceList[symbol]
}

// getData();
// getAcc()
// getTrade('CAKE');
// getLatesPrice('BNBUSDT')
