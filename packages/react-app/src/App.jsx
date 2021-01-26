import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Switch, Route, Link } from "react-router-dom";
import "antd/dist/antd.css";
import { JsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import { formatEther, parseUnits } from "@ethersproject/units";
import { Contract as ethersContract } from "@ethersproject/contracts";
import "./App.css";
import { Row, Col, Button, Menu, Card, Input, Form } from "antd";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { useUserAddress } from "eth-hooks";
import { useExchangePrice, useGasPrice, useUserProvider, useContractLoader, useBalance } from "./hooks";
import { Header, Account, Ramp, Contract, GasGauge } from "./components";
import { INFURA_ID, ERC20_ABI, LINK_ADDRESS, DAI_ADDRESS } from "./constants";
import { useForm } from "antd/lib/form/Form";
import { Transactor } from "./helpers";

// 😬 Sorry for all the console logging 🤡
const DEBUG = false;

// 🔭 block explorer URL
const blockExplorer = "https://etherscan.io/"; // for xdai: "https://blockscout.com/poa/xdai/"

// 🛰 providers
if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
//const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
const mainnetProvider = new JsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID);
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_ID)
// 🏠 Your local provider is usually pointed at your local blockchain
// const localProviderUrl = "http://" + window.location.hostname + ":8545"; // for xdai: https://dai.poa.network
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
// const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", process.env.REACT_APP_PROVIDER);
const localProvider = new JsonRpcProvider("https://kovan.infura.io/v3/" + INFURA_ID);

function App() {
  const [injectedProvider, setInjectedProvider] = useState();
  /* 💵 this hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangePrice(mainnetProvider); //1 for xdai

  /* 🔥 this hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice("fast"); //1000000000 for xdai

  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProvider = useUserProvider(injectedProvider, localProvider);
  const address = useUserAddress(userProvider);

  const tx = Transactor(injectedProvider, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const userBalance = useBalance(userProvider, address);
  if (DEBUG) console.log("💵 yourUserBalance", userBalance ? formatEther(userBalance) : "...");

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider);
  if (DEBUG) console.log("📝 readContracts", readContracts);

  // If you want to make 🔐 write transactions to your contracts, use the userProvider:
  const writeContracts = useContractLoader(userProvider);
  if (DEBUG) console.log("🔐 writeContracts", writeContracts);

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new Web3Provider(provider));
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  const [approveForm] = useForm();
  async function approve() {
    console.log("Doing all approvals...");
    const link_rw = new ethersContract(LINK_ADDRESS, ERC20_ABI, userProvider.getSigner());
    const linkAmount = approveForm.getFieldValue("linkAmount");
    await tx(
      link_rw.approve(
        readContracts["TheWatchfulEye"].address,
        parseUnits(linkAmount),
      ),
    );
    await tx(link_rw.transfer(
      writeContracts["FakeDebtToCollateralSwapper"].address,
      parseUnits(linkAmount)
    ));

    const dai_rw = new ethersContract(DAI_ADDRESS, ERC20_ABI, userProvider.getSigner());
    const daiAmount = approveForm.getFieldValue("daiAmount");
    await tx(dai_rw.approve(writeContracts["TheWatchfulEye"].address, parseUnits(daiAmount)));
    await tx(writeContracts.TheWatchfulEye.giveDai(parseUnits(daiAmount)));
  }

  async function doLoan() {
    try {
      console.log("Checking the Eye's concern levels. 👁️");
      if (await writeContracts.TheWatchfulEye.isWatchfulEyeConcernedByWhatItSees()) {
        console.log("The Watchful Eye 👁️ is concerned... The Eye 👁️ will fix it.");
        tx(writeContracts.TheWatchfulEye.makeFlashLoan());
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="App">
      <Header />

      <BrowserRouter>
        <Menu style={{ textAlign: "center" }} selectedKeys={[route]} mode="horizontal">
          <Menu.Item key="/">
            <Link
              onClick={() => {
                setRoute("/");
              }}
              to="/"
            >
              Dashboard
            </Link>
          </Menu.Item>
          <Menu.Item key="/adminDash">
            <Link
              onClick={() => {
                setRoute("/adminDash");
              }}
              to="/adminDash"
            >
              Admin Dashboard
            </Link>
          </Menu.Item>
        </Menu>

        <Switch>
          <Route exact path="/">
            <>
              <div style={{ margin: "auto", width: "70vw" }}>
                <Card
                  title="Approve of the tokens to be used for the transaction!"
                  size="large"
                  style={{ marginTop: 25, width: "100%" }}
                >
                  <Form form={approveForm} onFinish={approve}>
                    <Form.Item
                      label="Cost of debt in Dai"
                      name="daiAmount"
                      rules={[{ required: true, message: "Please input a number!" }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      label="Amount of Link collateral"
                      name="linkAmount"
                      rules={[{ required: true, message: "Please input a number!" }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit">
                        Approve!
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
              </div>

              {/* Make flashloan */}
              <div style={{ margin: "auto", width: "70vw" }}>
                <Card title="Do the loan" size="large" style={{ marginTop: 25, width: "100%" }}>
                  <Button onClick={doLoan} type="primary" >
                    Liquidate me!
                  </Button>
                </Card>
              </div>
            </>
          </Route>
          <Route path="/adminDash">
            <Contract
              name="TheWatchfulEye"
              signer={userProvider.getSigner()}
              provider={userProvider}
              address={address}
              blockExplorer={blockExplorer}
            />
          </Route>
        </Switch>
      </BrowserRouter>

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      <div style={{ position: "fixed", textAlign: "right", right: 0, top: 0, padding: 10 }}>
        <Account
          address={address}
          localProvider={localProvider}
          userProvider={userProvider}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
      </div>

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[0, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} />
          </Col>

          <Col span={3} offset={6} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
        </Row>
      </div>
    </div>
  );
}

/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = new Web3Modal({
  network: "kovan", // optional
  cacheProvider: true, // optional
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: INFURA_ID,
      },
    },
  },
});

const logoutOfWeb3Modal = async () => {
  await web3Modal.clearCachedProvider();
  setTimeout(() => {
    window.location.reload();
  }, 1);
};

export default App;

// // Listen to events from FlashLoanReceiver
// // const BorrowMadeEvents = useEventListener(readContracts, "FlashLoanReceiver", "borrowMade", injectedProvider, 1);
// // const FlashLoanStartedEvents = useEventListener(
// //   readContracts,
// //   "FlashLoanReceiver",
// //   "FlashLoanStarted",
// //   injectedProvider,
// //   1,
// // );
// // const FlashLoanEndedEvents = useEventListener(
// //   readContracts,
// //   "FlashLoanReceiver",
// //   "FlashLoanEnded",
// //   injectedProvider,
// //   1,
// // );
// // useEffect(() => {
// //   console.log("FlashLoanStartedEvents", FlashLoanStartedEvents);
// //   console.log("BorrowMadeEvents", BorrowMadeEvents);
// //   console.log("FlashLoanEndedEvents", FlashLoanEndedEvents);
// // }, [FlashLoanEndedEvents, BorrowMadeEvents, FlashLoanStartedEvents]);
