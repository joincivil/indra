import React, { Component } from 'react';
import { getConnextClient } from 'connext/dist/Connext';
import './App.css';
import ProviderOptions from './utils/ProviderOptions.ts';
import clientProvider from './utils/web3/clientProvider.ts';
import { setWallet } from './utils/actions.js';
import { createWallet, createWalletFromKey, findOrCreateWallet } from './walletGen';
import { createStore } from 'redux';
import Select from 'react-select';
import axios from 'axios';
import DepositCard from './components/depositCard';
import SwapCard from './components/swapCard';
import PayCard from './components/payCard';
import WithdrawCard from './components/withdrawCard';
import ChannelCard from './components/channelCard';
import FullWidthTabs from './components/walletTabs';
import Modal from '@material-ui/core/Modal';
import Button from '@material-ui/core/Button';
const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const eth = require('ethers');
//const util = require('ethereumjs-util')
require('dotenv').config();

// const ropstenWethAbi = require('./abi/ropstenWeth.json')
const humanTokenAbi = require('./abi/humanToken.json')

console.log(`starting app in env: ${JSON.stringify(process.env, null, 1)}`)
const hubUrl = process.env.REACT_APP_HUB_URL.toLowerCase()
//const providerUrl = process.env.REACT_APP_ETHPROVIDER_URL.toLowerCase()
const tokenAddress = process.env.REACT_APP_TOKEN_ADDRESS.toLowerCase()
const hubWalletAddress = process.env.REACT_APP_HUB_WALLET_ADDRESS.toLowerCase()
const channelManagerAddress = process.env.REACT_APP_CHANNEL_MANAGER_ADDRESS.toLowerCase()

const HASH_PREAMBLE = 'SpankWallet authentication message:'

const opts = {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': 'Bearer foo'
  },
  withCredentials: true
}

export const store = createStore(setWallet, null);

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      metamask: {
        address: null,
        balance: 0,
        tokenBalance: 0
      },
      usingMetamask: false,
      hubWallet: {
        address: hubWalletAddress,
        balance: 0,
        tokenBalance: 0
      },
      channelManager: {
        address: channelManagerAddress,
        balance: 0,
        tokenBalance: 0
      },
      authorized: "false",
      web3: null,
      wallet: null,
      address: null,
      balance: 0,
      tokenBalance: 0,
      browserWalletDeposit: {
        amountWei: "0",
        amountToken: "0"
      },
      toggleKey: false,
      walletSet: false,
      keyEntered: "",
      approvalWeiUser: "10000",
      recipient: hubWalletAddress,
      connext: null,
      channelState: null,
      exchangeRate: "0.00",
      tokenContract: null,
      useDelegatedSigner:true,
      delegatedSignerSelected:false,
      disableButtons:false,
      modalOpen:true
    };
    this.toggleKey = this.toggleKey.bind(this);
  }
  
  async setWalletAndProvider(metamask = false) {
    this.setState({authorized: false })
    let web3
    let address
    let wallet
    // get metamask address defaults
    const windowProvider = window.web3;
    if (!windowProvider) {
      console.log("Metamask is not detected.");
    }
    const metamaskWeb3 = new Web3(windowProvider.currentProvider);
    const metamaskAddr = (await metamaskWeb3.eth.getAccounts())[0].toLowerCase()
    console.log('detected metamask address:', metamaskAddr)

    try {
      if (metamask) {
        this.setState({ usingMetamask: true, })
        if (!windowProvider) {
          alert("You need to install & unlock metamask to do that");
          return;
        }
        address = (await metamaskWeb3.eth.getAccounts())[0].toLowerCase();
        if (!address) {
          alert("You need to install & unlock metamask to do that");
          return;
        }
        wallet = await this.walletHandler()
        web3 = metamaskWeb3
      } else {
        // New provider code
        const providerOpts = new ProviderOptions(store).approving();
        const provider = clientProvider(providerOpts);
        web3 = new Web3(provider);
        // create wallet. TODO: maintain wallet or use some kind of auth instead of generating new one.
        // as is, if you don't write down the privkey in the store you can't recover the wallet
        wallet = await this.walletHandler()
        address = wallet.getAddressString().toLowerCase()
      }

      await this.setState({ web3 });
      console.log("set up web3 successfully");

      console.log('wallet: ', wallet);
      // make sure wallet is linked to chain
      store.dispatch({
        type: "SET_WALLET",
        text: wallet
      });
      this.setState({ wallet: store.getState()[0] })

      this.setState({ address })
      console.log("Set up wallet:", address);

      const tokenContract = new web3.eth.Contract(humanTokenAbi, tokenAddress)
      this.setState({ tokenContract })
      console.log("Set up token contract");

    } catch (error) {
      alert(`Failed to load web3 or Connext. Check console for details.`);
      console.log(error);
    }
  }

  async setConnext() {
    const { web3, hubWallet, address, } = this.state
    console.log(`instantiating connext with hub as: ${hubUrl}`);
    console.log(`web3 address : ${await web3.eth.getAccounts()}`);

    const opts = {
      web3,
      hubAddress: hubWallet.address,
      //"0xfb482f8f779fd96a857f1486471524808b97452d" ,
      hubUrl: hubUrl, //http://localhost:8080,
      contractAddress: channelManagerAddress, //"0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42",
      user: address.toLowerCase(),
      tokenAddress,
    }

    console.log("Setting up connext with opts:", opts);

    // *** Instantiate the connext client ***
    const connext = getConnextClient(opts);

    console.log("Successfully set up connext!");

    await connext.start(); // start polling
    //console.log('Pollers started! Good morning :)')
    connext.on("onStateChange", state => {
      console.log("Connext state changed:", state);
      this.setState({
        channelState: state.persistent.channel,
      });
    });

    this.setState({ connext, });
    const channelState = connext.state ? connext.state.persistent.channel : null
    this.setState({ channelState })
    console.log(`This is connext state: ${JSON.stringify(this.state.channelState, null, 2)}`);
  }

  async pollExchangeRate() {
    const getRate = async () => {
      const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH')
      const json = await response.json()
      console.log('latest ETH->USD exchange rate: ', json.data.rates.USD);
      this.setState({
        exchangeRate: json.data.rates.USD
      })
    }
    getRate()
    setInterval(() => {
      getRate()
    }, 10000);
  }

  async pollBrowserWallet() {
    const browserWalletDeposit = async () => {
      const tokenContract = this.state.tokenContract
      const balance = await this.state.web3.eth.getBalance(this.state.address);
      const tokenBalance = await tokenContract.methods.balanceOf(this.state.address).call();
      if(balance !== "0" || tokenBalance !=="0"){
        this.setState({
          browserWalletDeposit:{
            amountWei: balance,
            amountToken: tokenBalance
          }
        })
      try{
        let approveFor = this.state.channelManager.address;
        let approveTx = await tokenContract.methods.approve(approveFor, this.state.depositVal);
        console.log(approveTx);
        console.log(`Depositing: ${JSON.stringify(this.state.browserWalletDeposit, null, 2)}`);
        console.log('********', this.state.connext.opts.tokenAddress)
        let depositRes = await this.state.connext.deposit(this.state.browserWalletDeposit);
        console.log(`Deposit Result: ${JSON.stringify(depositRes, null, 2)}`);
      } catch(e){
        console.log(`error depositing excess funds from autosigner: ${e}`)
      } 
    }
    }
    browserWalletDeposit()
    setInterval(() => {
      browserWalletDeposit()
    }, 80000);
  }

  updateApprovalHandler(evt) {
    this.setState({
      approvalWeiUser: evt.target.value
    });
  }

  walletChangeHandler = async (selectedWallet) => {
    this.setState({ selectedWallet, });
    if (selectedWallet.label === "Metamask") {
      await this.setWalletAndProvider(true)
    } else {
      await this.setWalletAndProvider(false)
    }

    await this.authorizeHandler();

    await this.setConnext()

    await this.refreshBalances()

    console.log(`Option selected:`, selectedWallet);
  }

  async handleMetamaskClose(){
    this.setState({ modalOpen: false });
    this.setState({ useDelegatedSigner: false});
    try{
      await this.setWalletAndProvider(true);
      await this.setConnext();
      await this.authorizeHandler();

      this.pollExchangeRate();
    }catch(e){
      console.log(`failed to set provider or start connext`)
    }
  };

  async handleDelegatedSignerSelect(){
    this.setState({ disableButtons: true});
    this.setState({ delegatedSignerSelected: true });
    this.setState({ useDelegatedSigner: true});
    try{
      await this.setWalletAndProvider(false);
      await this.setConnext();
      await this.authorizeHandler();

      this.pollExchangeRate();
      this.pollBrowserWallet();
    }catch(e){
      console.log(`failed to set provider or start connext`)
    }
  };

  handleClose = () => {
    this.setState({ modalOpen: false });
  };



  async approvalHandler(evt) {
    const web3 = this.state.web3
    const tokenContract = this.state.tokenContract
    const approveFor = channelManagerAddress;
    const toApprove = this.state.approvalWeiUser;
    const toApproveBn = eth.utils.bigNumberify(toApprove);
    const nonce = await web3.eth.getTransactionCount(this.state.wallet.address);
    const depositResGas = await tokenContract.methods.approve(approveFor, toApproveBn).estimateGas();
    let tx = new Tx({
      to: tokenAddress,
      nonce: nonce,
      from: this.state.wallet.address,
      gasLimit: depositResGas * 2,
      data: tokenContract.methods.approve(approveFor, toApproveBn).encodeABI()
    })
    tx.sign(Buffer.from(this.state.wallet.privateKey.substring(2), 'hex'))
    let signedTx = '0x' + tx.serialize().toString('hex')
    let sentTx = web3.eth.sendSignedTransaction(signedTx, (err) => { if (err) console.error(err) })
    sentTx
      .once('transactionHash', (hash) => { console.log(`tx broadcasted, hash: ${hash}`) })
      .once('receipt', (receipt) => { console.log(`tx mined, receipt: ${JSON.stringify(receipt)}`) })
    console.log(`Sent tx: ${typeof sentTx} with keys ${Object.keys(sentTx)}`);
  }

  //Connext Helpers



  async collateralHandler() {
    console.log(`Requesting Collateral`);
    let collateralRes = await this.state.connext.requestCollateral();
    console.log(`Collateral result: ${JSON.stringify(collateralRes, null, 2)}`);
  }

  // Other Helpers
  getKey() {
    console.log(store.getState()[0]);
    function _innerGetKey() {
      const key = store.getState()[0].mnemonic;
      return key;
    }
    let privKey = _innerGetKey();
    console.log(`privkey: ${JSON.stringify(privKey)}`)
    return privKey;
  }

  toggleKey(evt) {
    evt.preventDefault();
    this.setState(prevState => ({ toggleKey: !prevState.toggleKey }), () => { });
  }

  // WalletHandler - it works but i'm running into some lifecycle issues. for option for user
  // to create wallet from privkey to display,
  // wallet creation needs to be in componentDidUpdate. but everything goes haywire when that happens so idk

  async walletHandler() {
    let wallet;
    let key = this.state.keyEntered;
    if (key) wallet = createWalletFromKey(key);
    else {
      wallet = await findOrCreateWallet(this.state.web3);
    }
    this.setState({ walletSet: true });
    return wallet;
  }

  updateWalletHandler(evt) {
    this.setState({
      keyEntered: evt.target.value
    });
    console.log(`Updating state : ${this.state.depositVal}`);
  }

  async createWallet() {
    await createWallet(this.state.web3);
    window.location.reload(true);
  }

  async authorizeHandler(evt) {
    const web3 = this.state.web3
    const challengeRes = await axios.post(`${hubUrl}/auth/challenge`, {}, opts);

    const hash = web3.utils.sha3(`${HASH_PREAMBLE} ${web3.utils.sha3(challengeRes.data.nonce)} ${web3.utils.sha3("localhost")}`)

    const signature = await web3.eth.personal.sign(hash, this.state.address)

    try {
      let authRes = await axios.post(
        `${hubUrl}/auth/response`,
        {
          nonce: challengeRes.data.nonce,
          address: this.state.address,
          origin: "localhost",
          signature,
        },
        opts
      );
      const token = authRes.data.token;
      document.cookie = `hub.sid=${token}`;
      console.log(`cookie set: ${token}`);
      const res = await axios.get(`${hubUrl}/auth/status`, opts);
      if (res.data.success) {
        this.setState({ authorized: true });
      } else {
        this.setState({ authorized: false });
      }
      console.log(`Auth status: ${JSON.stringify(res.data)}`);
    } catch (e) {
      console.log(e);
    }
  }

  // to get tokens from metamask to browser wallet
  

  // ** wrapper for ethers getBalance. probably breaks for tokens

  render() {
    return (
      <div className="app">
      <Modal
          className="modal"
          aria-labelledby="simple-modal-title"
          aria-describedby="simple-modal-description"
          open={this.state.modalOpen}
        >
          <div>
          <div className="row">
            <div className="column">
            <Button 
                    variant="contained" 
                    color="primary"
                    disabled={this.state.disableButtons} 
                    onClick={() => this.handleMetamaskClose()}
                    >
              Use Metamask to sign
              </Button>
            </div>
            <div className="column">
            <Button
                variant="contained" 
                color="primary"
                disabled={this.state.disableButtons}
                onClick={() => this.handleDelegatedSignerSelect()}>
              Use Autosigner
            </Button>
            </div>
            </div>
            <div className="row">
            <div className="column">
            {this.state.delegatedSignerSelected ? 
            (<div>
             <div> 
            The following mnemonic is the recovery phrase for your wallet.<br/>
            If you lose it and are locked out of your wallet, you will lose access<br />
             to any funds remaining in your channel. <br />Keep it secret, keep it safe.
             <br /> <br />
             {`${JSON.stringify(() => this.getKey())}`}
            </div>
            <div>
                <Button variant="contained" onClick={this.handleClose}> Close</Button>
            </div>
            </div>
            )
            :
            (null)}
            </div>
          </div>
          </div>
        </Modal>
        <div className="row" style={{justifyContent: 'center'}}>
          <img style={{height:'70px', width:'300px'}} src="https://connext.network/static/media/logoHorizontal.3251cc60.png" />
        </div>
        <div className="row" style={{flexWrap:"nowrap"}}>
          <div className="column">
           <ChannelCard 
              channelState={this.state.channelState}/>
          </div>
          <div className="column">
            <FullWidthTabs 
              metamask={this.state.metamask} 
              channelManager={this.state.channelManager}
              hubWallet={this.state.hubWallet} 
              web3={this.state.web3}
              tokenContract={this.state.tokenContract}/>
          </div>
        </div>
        <div className="row">
          <div className="column">
            <DepositCard
              channelManagerAddress={this.state.channelManager.address}
              Web3={window.web3}
              tokenContract={this.state.tokenContract}
              humanTokenAbi={humanTokenAbi}
              connext={this.state.connext}
              />
          </div>
          <div className="column">
            <SwapCard
              connext={this.state.connext}
              exchangeRate={this.state.exchangeRate}
              />
          </div>
          <div className="column">
            <PayCard
              connext={this.state.connext}
              />
          </div>
          <div className="column">
            <WithdrawCard
              connext={this.state.connext}
              exchangeRate={this.state.exchangeRate}
              />
          </div>         
        </div>
        <div className="row">
          <div className="column">
            Made with 💛 by the Connext Team
          </div>
        </div>
        
        {/* <button className="btn" onClick={() => this.createWallet()}>
                  Create New Browser Wallet
                </button>
              </div>
            ) : (
                <div>
                  Enter your private key. If you do not have a wallet, leave blank and we'll create one for you.
                <div>
                    <input defaultValue={""} onChange={evt => this.updateWalletHandler(evt)} />
                  </div>
                  <button className="btn">Get wallet</button> */}
    </div>
    );
  }
}

export default App;
