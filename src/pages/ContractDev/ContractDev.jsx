import React, { Component } from 'react';
import { Select } from '@icedesign/base';
import { Button, Tab, Grid, Tree, Dialog, Collapse, Message, Input, Card } from '@alifd/next';
import * as hyperchain from 'hyperchain-web3';
import {AbiCoder as EthersAbiCoder} from 'ethers/utils/abi-coder';
import cookie from 'react-cookies';
import copy from 'copy-to-clipboard';
import ReactJson from 'react-json-view';
import IceEllipsis from '@icedesign/ellipsis';

import * as utils from '../../utils/utils';
import * as Keystore from '../../utils/keystore';
import { T } from '../../utils/lang';
import * as Constant from '../../utils/constant';
import ContractEditor from './components/Editor';
import * as CompilerSrv from './CompilerSrv';
import './ContractDev.scss';

const { Row, Col } = Grid;
const TreeNode = Tree.Node;
const Panel = Collapse.Panel;

const TxReceiptResult = ({self, contractAddress, funcName}) => {
  return <div>
    <Button key='getTxInfo' type="primary" onClick={self.getTxInfo.bind(self, contractAddress, funcName)} style={{marginRight: '20px'}}>{T('查询交易')}</Button>
    <Button key='getReceiptInfo' type="primary" onClick={self.getReceiptInfo.bind(self, contractAddress, funcName)}>{T('查询Receipt')}</Button>
    <br /><br />
    <Input.Group addonBefore={T("交易/Receipt信息:")} style={{ width: 600 }}>
      <Input.TextArea  key='txReceiptResult' id={contractAddress + funcName + 'TxReceipt'} 
        value={self.state.result[contractAddress + funcName + 'TxReceipt']}
        autoHeight
        style={{ width: 600 }}
        size="medium"
      />
    </Input.Group>
   
  </div>
}

// constructor use contract name, and other functions use contract address
const Parameters = ({self, contractAddress, funcName, parameterNames, parameterTypes, width}) => {
  return parameterNames.map((paraName, index) => (
    <div>
      <Input key={paraName} hasClear
        onChange={self.handleParaValueChange.bind(self, contractAddress, funcName, paraName)}
        style={{ width }}
        addonTextBefore={paraName}
        size="medium"
        placeholder={parameterTypes[index]}
        />
      <br /><br />
    </div>
  ))
}

const OneFunc = ({self, contractAddress, funcName, parameterTypes, parameterNames}) => {
  let callBtnName = T('查询结果');
  if (!self.state.funcParaConstant[contractAddress][funcName]) {
    callBtnName = T('发起合约交易');
  }
  return <Card style={{ width: 800, marginBottom: "20px" }} bodyHeight="auto" title={funcName}>
          <Parameters self={self} contractAddress={contractAddress} funcName={funcName}  width='600px'
            parameterNames={parameterNames} parameterTypes={parameterTypes} />
          <Button type="primary" onClick={self.callContractFunc.bind(self, contractAddress, funcName)}>{callBtnName}</Button>
          <br />
          <br />
          <Input.TextArea autoHeight readOnly style={{ width: 600 }} 
            value={self.state.result[contractAddress + funcName]}
            addonTextBefore={T('结果')} size="medium"/>
          <br />
          <br />
          {
            !self.state.funcParaConstant[contractAddress][funcName] ? 
              <TxReceiptResult self={self} contractAddress={contractAddress} funcName={funcName} /> : ''
          }
         </Card>;
}

const DisplayOneTypeFuncs = ({self, contract, abiInfos}) => {
  const {contractAddress} = contract;

  return (<Collapse rtl='ltr'>
          {abiInfos.map((interfaceInfo, index) => {
            if (interfaceInfo.type === 'function') {
              const funcName = interfaceInfo.name;
              const parameterTypes = [];
              const parameterNames = [];
              for (const input of interfaceInfo.inputs) {
                parameterTypes.push(input.type);
                parameterNames.push(input.name);
              }

              self.state.funcParaTypes[contractAddress][funcName] = parameterTypes;
              self.state.funcParaNames[contractAddress][funcName] = parameterNames;
              self.state.funcResultOutputs[contractAddress][funcName] = interfaceInfo.outputs;
              self.state.funcParaConstant[contractAddress][funcName] = interfaceInfo.constant;
              return <Panel key={index}  title={funcName}>
                      <OneFunc key={contractAddress + funcName} self={self} 
                        contractAddress={contractAddress}
                        funcName={funcName} parameterTypes={parameterTypes} parameterNames={parameterNames}/>
                    </Panel>;      
            }
          })}
        </Collapse>);
}

const ContractArea = ({ self, contract }) => {
  const {contractAddress} = contract;
  self.state.funcParaTypes[contractAddress] = {};
  self.state.funcParaNames[contractAddress] = {};
  self.state.funcResultOutputs[contractAddress] = {};
  self.state.funcParaConstant[contractAddress] = {};
    
  const readonlyFuncs = [];
  const writableFuncs = [];
  const writablePayableFuncs = [];
  contract.contractAbi.map((interfaceInfo, index) => {
    if (interfaceInfo.type === 'function') {
      if (interfaceInfo.constant) {
        readonlyFuncs.push(interfaceInfo);
      } else {
        writableFuncs.push(interfaceInfo);
      }
    }
  }
  );

  return <div>
          合约地址: {contractAddress}<br/><br/>
          只读类接口:{readonlyFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={readonlyFuncs} contract={contract}/>
          <br/>写入类接口:{writableFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={writableFuncs} contract={contract}/>
          {/* <br/>写入并可支付类接口:{writablePayableFuncs.length == 0 ? '无' : ''}<br/>
          <DisplayOneTypeFuncs self={self} abiInfos={writablePayableFuncs} contract={contract}/> */}
        </div>        
} 

const ContractCollapse = ({self, contractAccountInfo}) => {
  global.localStorage.setItem('contractAccountInfo', JSON.stringify(contractAccountInfo));
  return <Collapse rtl='ltr'>
            {contractAccountInfo.map((contract, index) => (
              <Panel key={index}  
                title={'编号：' + (index + 1) + '，合约地址:' + contract.contractAddress 
                    + '，合约名：' + contract.contractName + '，时间：' + (contract.genTime != null ? contract.genTime : '')}>
                <ContractArea self={self} contract={contract}/>
              </Panel>
            ))}
         </Collapse>
}

const ActionType = { DeployContract: 0, InvokeContract: 1, UpdateContract: 2 }

const pwdPlaceholder = T("钱包密码，由数字加字母组成，不少于8位");

export default class ContractManager extends Component {
  static displayName = 'ContractManager';

  constructor(props) {
    super(props);
    let abiInfoStr = '';
    const abiInfo = global.localStorage.getItem('abiInfo');
    if (abiInfo != null) {
      abiInfoStr = JSON.stringify(abiInfo).replace(/\\"/g, '"');
      abiInfoStr = abiInfoStr.substring(1, abiInfoStr.length - 1);
    }
    const abiContractName = cookie.load('abiContractName');

    this.state = {
      password: '',
      accountReg: new RegExp('^([a-z][a-z0-9]{6,15})(?:\.([a-z0-9]{2,16})){0,1}(?:\.([a-z0-9]{2,16})){0,1}$'),
      addresses: [],
      contractFuncInfo: [],
      abiInfos: [],
      contractAccountInfo: [],
      accountsOfShareCode: ['0x4d93a58912ba194cfe0135f33c58097bc5893068'],
      abiInfo: abiInfoStr,
      paraValue: {},
      funcParaTypes: {},
      funcParaNames: {},
      funcResultOutputs: {},
      funcParaConstant: {},
      funcResultOutputs: {},
      result: {},
      txInfo: {},
      txSendVisible: false,
      defaultAccountName: '',
      contractName: abiContractName,
      contractAccount: abiContractName,
      selectedAccount: null,
      selectedAccountAddress: '',
      transferTogether: {},
      visibilityValue: {},
      curContractAddress: '',
      curContractName: '',
      curCallFuncName: '',
      curTxResult: {},
      resultDetailInfo: '',
      solFileList: ['sample.sol'],
      tabFileList: ['sample.sol'],
      libFileList: [],
      smapleFileList: [],
      fileContractMap: {},
      contractList: [],
      contractAccountAbiMap: {},
      activeKey: '',
      addNewContractFileVisible: false,
      deployContractVisible: false,
      compileSrvSettingVisible: false,
      contractInfoVisible: false,
      displayAbiVisible: false,
      displayBinVisible: false,
      curAbi: null,
      curBin: null,
      loadedContractAddress: '',
      compileSrv: 'http://52.194.255.222:8081',
      selectContactFile: '',
      selectedFileToCompile: null,
      selectedContractToDeploy: null,
      resultInfo: '日志输出:\n',
      newContractAccountName: '',
      keystoreInfo: {},
      suggestionPrice: 1,
      gasLimit: 1000000,
      ftAmount: 1,      
      method: null,
      constructorParaNames: [],
      constructorParaTypes: [],
      ethersAbiCoder: new EthersAbiCoder(),
     };
     
    const keystoreList = utils.loadKeystoreFromLS();    
    if (keystoreList.length == 0) {
      for (let i = 0; i < 5; i++) {
        const key = Keystore.generateKey();
        keystoreList.push(key);
      }
      utils.storeDataToFile(Constant.KeyStoreFile, keystoreList);
    }
    for (const keystore of keystoreList) {
      this.state.keystoreInfo[keystore.address] = keystore;
      this.state.addresses.push({label: keystore.address, value: keystore.address});
    }
    this.state.selectedAccountAddress = this.state.addresses.length > 0 ? this.state.addresses[0].value : '';

    const solFileList = global.localStorage.getItem('solFileList');
    if (solFileList != null) {
      this.state.solFileList = solFileList.split(',');
    }
    if (this.state.solFileList.length > 0) {
    this.state.tabFileList = [this.state.solFileList[0]];
    this.state.activeKey = this.state.tabFileList[0];
    }

    const contractAccountInfo = global.localStorage.getItem('contractAccountInfo');
    if (contractAccountInfo != null) {
      this.state.contractAccountInfo = JSON.parse(contractAccountInfo);
    }   
    
    const contractList = global.localStorage.getItem('contractList');
    if (contractList != null) {
     this.state.contractList = JSON.parse(contractList);
    }

    const fileContractMap = global.localStorage.getItem('fileContractMap');
    if (fileContractMap != null) {
      this.state.fileContractMap = JSON.parse(fileContractMap);
    }
  }

  componentDidMount = async () => {
    hyperchain.utils.setProvider(this.state.compileSrv);      
    this.syncSolFileToSrv();  

    const libFiles = await CompilerSrv.getLibSolFile();
    for(var fileName in libFiles) {
      this.state.libFileList.push(fileName);
      global.localStorage.setItem('sol:' + fileName, libFiles[fileName]);
    }
    
    const sampleFiles = await CompilerSrv.getSampleSolFile();
    for(var fileName in sampleFiles) {
      this.state.smapleFileList.push(fileName);
      global.localStorage.setItem('sol:' + fileName, sampleFiles[fileName]);
    }

    this.setState({libFileList: this.state.libFileList, smapleFileList: this.state.smapleFileList});
  }

  handleContractAccountChange = (value) => {
    this.state.contractAccount = value;
  }

  saveContractName = (value) => {
    this.state.contractName = value.currentTarget.defaultValue;
    cookie.save('abiContractName', this.state.contractName);
  }

  handleABIInfoChange = (value) => {
    this.setState({ abiInfo: value });
  }

  checkABI = (abiInfo) => {
    if (utils.isEmptyObj(abiInfo) 
    || (!utils.isEmptyObj(abiInfo) && !hyperchain.utils.isValidABI(abiInfo))) {
      Message.error(T('ABI信息不符合规范，请检查后重新输入'));
      return false;
    }
    return true;
  }

  handleParaValueChange = (contractAddress, funcName, paraName, value) => {
    this.state.paraValue[contractAddress + '-' + funcName + '-' + paraName] = value;
  }

  onChangeAddress = (accountAddress, item) => {
    this.state.selectedAccountAddress = accountAddress;
    this.setState({ selectedAccountAddress: accountAddress });
    this.syncSolFileToSrv();
  }

  
  changeLog = (v) => {
    this.state.resultInfo = v;
    this.setState({resultInfo: this.state.resultInfo});
  }

  handleContractNoChange = (v) => {
    this.state.contractIndex = v;
  }

  removeContractCall = () => {
    if (utils.isEmptyObj(this.state.contractIndex)) {
      Message.error(T('请输入待删除合约界面的编号'));
      return;
    }
    const index = parseInt(this.state.contractIndex);
    if (index > this.state.contractAccountInfo.length || index < 1) {
      Message.error('当前编号必须大于0，小于等于' + this.state.contractAccountInfo.length);
      return;
    }
    this.state.contractAccountInfo.splice(index - 1, 1);
    this.setState({contractAccountInfo: this.state.contractAccountInfo});
  }

  onChangeContractFile = (fileToCompile) => {
    this.setState({ selectedFileToCompile: fileToCompile });
  }

  onChangeContract = (contractToDeploy) => {
    const oneContractABI = this.getContractABI(contractToDeploy);
    if (oneContractABI != null) {
      this.parseConstructorInputs(oneContractABI);
    }
    this.state.curContractName = contractToDeploy.split(':')[1];
    this.setState({ selectedContractToDeploy: contractToDeploy, curContractName: this.state.curContractName });
  }

  handleLoadedContractAddressChange = (v) => {
    this.setState({ loadedContractAddress: v });
  }

  loadContract = () => {
    if (utils.isEmptyObj(this.state.loadedContractAddress)) {
      Message.error(T('请输入合约地址'));
      return;
    }
    const contractAbi = utils.getContractABI(this.state.loadedContractAddress);
    if (!utils.isEmptyObj(contractAbi)) {
      const contractName = this.getContractName(this.state.loadedContractAddress);
      this.displayContractFunc(this.state.loadedContractAddress, 
                                utils.isEmptyObj(contractName) ? 'tmpName-' + utils.getRandomInt(10000) : contractName , 
                                contractAbi);
      return;
    } else {
      Message.error(T('无此地址的ABI信息，因此无法加载'));
      return;
    }
  }
  addLog = (logInfo) => {
    let date = new Date().toLocaleString();
    logInfo = date + ':' + logInfo + '\n\n';
    this.setState({resultInfo: this.state.resultInfo + logInfo});
  }

  copyAddress = () => {
    if (utils.isEmptyObj(this.state.selectedAccountAddress)) {
      Message.error(T('请选择需要拷贝的地址'));
      return;
    }
    
    copy(this.state.selectedAccountAddress);
    Message.success(T('地址已复制到粘贴板'));
  }

  addAddress = () => {
    const keystoreList = utils.loadKeystoreFromLS();    
    const key = Keystore.generateKey();
    this.state.keystoreInfo[key.address] = key;
    this.state.addresses.push({label: key.address, value: key.address});
    keystoreList.push(key);
    utils.storeDataToFile(Constant.KeyStoreFile, keystoreList);
    this.setState({addresses: this.state.addresses});
    Message.success(T('地址添加成功'));
  }

  compileContract = async () => {
    if (utils.isEmptyObj(this.state.selectedFileToCompile)) {
      Message.error(T('请选择待编译的文件'));
      return;
    }
    Message.success('开始编译');
    this.addLog("开始编译");
    try {
      const compileResult = await CompilerSrv.compileSol(this.state.selectedAccountAddress, this.state.selectedFileToCompile);
      if (compileResult.result == false) {
        Message.error("编译失败,错误信息:" + compileResult.err);
        this.addLog("编译失败,错误信息:" + compileResult.err);
        return;
      }
      Message.success("编译成功");
      this.state.fileContractMap[this.state.selectedFileToCompile] = compileResult;
      for (let contractName in compileResult) {
        this.addLog("合约" + contractName + "编译结果BIN:\n" + compileResult[contractName].bin);
        this.addLog("合约" + contractName + "编译结果ABI:\n" + compileResult[contractName].abi);
      }

      this.state.contractList = [];
      for (var contractFile in this.state.fileContractMap) {
        const compiledInfo = this.state.fileContractMap[contractFile];
        for (let contractName in compiledInfo) {
          this.state.contractList.push(contractFile + ":" + contractName);
        }
      }
      global.localStorage.setItem("contractList", JSON.stringify(this.state.contractList));
      global.localStorage.setItem("fileContractMap", JSON.stringify(this.state.fileContractMap));
      if (this.state.selectedContractToDeploy != null 
        && this.state.selectedContractToDeploy.indexOf(this.state.selectedFileToCompile) > -1) {
          this.state.selectedContractToDeploy = "";
          this.state.constructorParaNames = [];
          this.state.constructorParaTypes = [];
      }
      this.setState({contractList: this.state.contractList});
    } catch (error) {
      Message.error("编译失败:" + error);
      this.addLog("编译失败:" + error);
    }
  }
  
  syncSolFileToSrv = () => {
    for (const solFile of this.state.solFileList) {
     const solCode = global.localStorage.getItem('sol:' + solFile);
     CompilerSrv.updateSol(this.state.selectedAccountAddress, solFile, solCode);
    }
  }

  setCompileSrv = () => {
    this.setState({compileSrvSettingVisible: true});
  }

  getContractABI = (contractInfos) => {
    const contractInfoElements = contractInfos.split(":");
    const contractFileName = contractInfoElements[0];
    const contractName = contractInfoElements[1];
    const compiledFileInfo = this.state.fileContractMap[contractFileName];
    for (let compiledContractName in compiledFileInfo) {
      if (compiledContractName == contractName) {
        return JSON.parse(compiledFileInfo[contractName].abi);
      }
    }
    return null;
  }

  parseConstructorInputs = (contractAbi) => {
    this.state.constructorParaNames = [];
    this.state.constructorParaTypes = [];
    for (let interfaceInfo of contractAbi) {
      if (interfaceInfo.type == 'constructor') {
        for (let input of interfaceInfo.inputs) {
          this.state.constructorParaNames.push(input.name);
          this.state.constructorParaTypes.push(input.type);
        }
        return;
      }
    }
  }
  getCompileInfo = (isAbi) => {
    if (this.state.selectedContractToDeploy == null) {
      Message.error(T('请选择需要获取其ABI信息的合约'));
      return;
    }
    const contractInfos = this.state.selectedContractToDeploy.split(":");
    const fileName = contractInfos[0];
    const compileResult = this.state.fileContractMap[fileName];
    for (let contractName in compileResult) {
      if (contractName == contractInfos[1]) {
        if (isAbi) {
          this.setState({curAbi: JSON.parse(compileResult[contractName].abi), displayAbiVisible: true});
        } else {
          this.setState({curBin: compileResult[contractName].bin, displayBinVisible: true});
        }
      }
    }
  }
  getAbi = () => {
    this.getCompileInfo(true);
  }
  getBin = () => {
    this.getCompileInfo(false);
  }
  
  onDisplayABIOK = () => {
    copy(JSON.stringify(this.state.curAbi));
    Message.success(T('ABI信息已拷贝到粘贴板'));
  }

  onDisplayABIClose = () => {
    this.setState({ displayAbiVisible: false });
  }

  onDisplayBINOK = () => {
    copy(this.state.curBin);
    Message.success(T('BIN信息已拷贝到粘贴板'));
  }

  onDisplayBINClose = () => {
    this.setState({ displayBinVisible: false });
  }
  // 部署合约
  deployContract = () => {
    try {
      if (utils.isEmptyObj(this.state.selectedAccountAddress)) {
        Message.error(T('请选择发起合约部署操作的账号'));
        return;
      }
      if (this.state.selectedContractToDeploy == null) {
        Message.error(T('请选择需要部署的合约'));
        return;
      }
      const contractInfos = this.state.selectedContractToDeploy.split(":");
      const compiledFileInfo = this.state.fileContractMap[contractInfos[0]];
      let contractBin = '';
      for (let contractName in compiledFileInfo) {
        if (contractName == contractInfos[1]) {
          contractBin = compiledFileInfo[contractName].bin;
          this.state.curContractABI = JSON.parse(compiledFileInfo[contractName].abi);
          this.state.curContractName = contractName;
        }
      }
      if (contractBin.length == 0) {
        Message.error('无合约bin信息');
        return;
      }
      const values = [];
      let index = 0;
      for (let paraName of this.state.constructorParaNames) {
        let value = this.state.paraValue[this.state.curContractName + '-constructor-' + paraName];
        if (value == null) {
          Message.error('参数' + paraName + '尚未输入值');
          return;
        }
        const type = this.state.constructorParaTypes[index];
        if (type == 'bool') {
          value = ((value == 'false' || value == 0) ? false : true);
        }else if (type.lastIndexOf(']') === type.length - 1) {
          if (value.indexOf('[') != 0 || value.lastIndexOf(']') != value.length - 1) {
            Message.error('数组类型的值请按如下格式填写：[a,b,c]');
            return;
          }          
          values.push(value.substr(1, value.length - 2).split(','));
        } else {
          values.push(value);
        }
        values.push(value);
        index++;
      }
      const constructorPayload = hyperchain.utils.getConstructPayload(this.state.constructorParaTypes, values);

      this.state.txInfo = {from: this.state.selectedAccountAddress, payload: contractBin + constructorPayload};   
      this.state.method = ActionType.DeployContract;
      this.signTxAndSend(this.state.txInfo);
    } catch (error) {
      Message.error(error.message || error);
      this.addLog(error.message);
    }
  }
  // 更新合约
  updateContract = () => {
    try {
      if (utils.isEmptyObj(this.state.selectedAccountAddress)) {
        Message.error(T('请选择发起合约更新操作的账号'));
        return;
      }
      if (this.state.selectedContractToDeploy == null) {
        Message.error(T('请选择需要更新的合约'));
        return;
      }
      if (utils.isEmptyObj(this.state.loadedContractAddress)) {
        Message.error(T('请输入合约地址'));
        return;
      }
      const contractInfos = this.state.selectedContractToDeploy.split(":");
      const compiledFileInfo = this.state.fileContractMap[contractInfos[0]];
      let contractBin = '';
      for (let contractName in compiledFileInfo) {
        if (contractName == contractInfos[1]) {
          contractBin = compiledFileInfo[contractName].bin;
          this.state.curContractABI = JSON.parse(compiledFileInfo[contractName].abi);
          this.state.curContractName = contractName;
        }
      }
      if (contractBin.length == 0) {
        Message.error('无合约bin信息');
        return;
      }
  
      this.state.txInfo = {from: this.state.selectedAccountAddress, to: this.state.loadedContractAddress,
                           payload: contractBin, opcode: 1};   
      this.state.method = ActionType.UpdateContract;
      this.signTxAndSend(this.state.txInfo);
    } catch (error) {
      Message.error(error.message || error);
      this.addLog(error.message);
    }
  }

  callContractFunc = (contractAddress, funcName) => {
    if (utils.isEmptyObj(this.state.selectedAccountAddress)) {
      Message.error(T('请选择发起合约调用的账号'));
      return;
    }

    if (utils.isEmptyObj(contractAddress)) {
      Message.error(T('请输入合约地址'));
      return;
    }
    const paraNames = this.state.funcParaNames[contractAddress][funcName];
    const values = [];
    let index = 0;
    for (const paraName of paraNames) {
      const value = this.state.paraValue[contractAddress + '-' + funcName + '-' + paraName];
      if (value == null) {
        Message.error(T('参数') + paraName + T('尚未输入值'));
        return;
      }
      const type = this.state.funcParaTypes[contractAddress][funcName][index];
      if (type.lastIndexOf(']') === type.length - 1) {
        if (value.indexOf('[') != 0 || value.lastIndexOf(']') != value.length - 1) {
          Message.error('数组类型的值请按如下格式填写：[a,b,c]');
          return;
        }          
        values.push(value.substr(1, value.length - 2).split(','));
      } else {
        values.push(value);
      }
      index++;
    }
    const simulate = this.state.funcParaConstant[contractAddress][funcName];
    const payload = '0x' + hyperchain.utils.getContractPayload(funcName, this.state.funcParaTypes[contractAddress][funcName], values);
    this.state.txInfo = {'from': this.state.selectedAccountAddress, 'to': contractAddress, 'payload': payload, simulate};
    
    this.state.curContractAddress = contractAddress;
    this.state.curCallFuncName = funcName;
    this.state.method = ActionType.InvokeContract;
    this.signTxAndSend(this.state.txInfo);
  }

  getTxInfo = (contractAddress, funcName) => {
    const txHash = this.state.result[contractAddress + funcName];
    if (txHash != null) {
      if (txHash.indexOf('0x') != 0) {
        Message.error(T('非交易hash，无法查询'));
        return;
      }
      hyperchain.transaction.getTransactionByHash(txHash).then(txInfo => {        
        this.addLog("交易信息\n" + JSON.stringify(txInfo));
        this.state.result[contractAddress + funcName + 'TxReceipt'] = JSON.stringify(txInfo);
        this.setState({result: this.state.result});
      });
    }
  }

  getReceiptInfo = (contractAddress, funcName) => {
    const txHash = this.state.result[contractAddress + funcName];
    if (txHash != null) {
      if (txHash.indexOf('0x') != 0) {
        Message.error(T('非交易hash，无法查询'));
        return;
      }
      hyperchain.transaction.getTransactionReceipt(txHash).then(receipt => {        
        if (receipt == null) {
          Message.error(T('receipt尚未生成'));
          return;
        }
        this.addLog("receipt\n" + JSON.stringify(receipt));
        this.state.result[contractAddress + funcName + 'TxReceipt'] = JSON.stringify(receipt);
        this.setState({result: this.state.result});
        
        if (receipt.valid < 0) {
          Message.error(T('Receipt表明本次交易执行失败，原因:') + ':' + receipt.errorMsg);
        } else {
          Message.success(T('Receipt表明本次交易执行成功'));
        }
      });
    }
  }

  getTxResult = (result) => {
    this.addLog("调用函数" + this.state.curCallFuncName + "获取的结果:" + result);
    this.state.result[this.state.curContractName + this.state.curCallFuncName] = result;
    this.setState({result: this.state.result});
    this.state.curTxResult[this.state.curContractName] = {};
    this.state.curTxResult[this.state.curContractName][this.state.curCallFuncName] = result;
  }

  selectTab = (key) => {
    this.setState({activeKey: key});
  }

  addSolTab = (fileName) => {
    if (fileName == null) {
      return;
    }
    let exist = false;
    this.state.tabFileList.map(tabFileName => {
      if (fileName == tabFileName) {
        exist = true;
      }
    });
    if (exist) {
      this.setState({activeKey: fileName});
    } else {
      this.state.tabFileList.push(fileName);
      this.setState({activeKey: fileName, tabFileList: this.state.tabFileList});
    }
  }

  delSolTab = (fileName) => {
    let index = this.state.tabFileList.indexOf(fileName);
    if (index > -1) {
      this.state.tabFileList.splice(index, 1);
    }
    if (index >= this.state.tabFileList.length) {
      index = this.state.tabFileList.length - 1;
    }
    this.setState({tabFileList: this.state.tabFileList, activeKey: index >= 0 ? this.state.tabFileList[index] : ''});
  }

  updateSolTab = (oldFileName, newFileName) => {
    const index = this.state.tabFileList.indexOf(oldFileName);
    if (index > -1) {
      this.state.tabFileList.splice(index, 1, newFileName);
    }
    let activeLabKey = this.state.activeKey;
    if (activeLabKey == oldFileName) {
      activeLabKey = newFileName;
    }

    const solCode = global.localStorage.getItem('sol:' + oldFileName);
    global.localStorage.setItem('sol:' + newFileName, solCode);
    global.localStorage.removeItem('sol:' + oldFileName);

    this.setState({activeKey: activeLabKey, tabFileList: this.state.tabFileList});
  }

  onClose = (targetKey) => {
    this.delSolTab(targetKey);
  }

  onEditFinish(key, label, node) {
    this.state.solFileList.map((solFileName, index) => {
      if (solFileName == key) {        
        this.state.solFileList[index] = label;
      }
    });
    if (this.state.selectedFileToCompile == key) {
      this.state.selectedFileToCompile = label;
    }
    this.state.contractList.map((contractFile, index) => {
      const contractInfos = contractFile.split(":");
      if (contractInfos[0] == key) {        
        this.state.contractList[index] = label + ":" + contractInfos[1];
      }
    });
    if (this.state.selectedContractToDeploy != null && this.state.selectedContractToDeploy.split(":")[0] == key) {
      this.state.selectedContractToDeploy = label + ":" + this.state.selectedContractToDeploy.split(":")[1];
    }

    this.setState({solFileList: this.state.solFileList, contractFile: this.state.contractList});
    this.updateSolTab(key, label);
    CompilerSrv.renameSol(this.state.selectedAccountAddress, key, label);
  }

  onSelectSolFile = (selectedKeys) => {
    console.log('onSelectSolFile', selectedKeys);
    this.state.selectContactFile = selectedKeys[0];
    this.addSolTab(this.state.selectContactFile);
  }
  addSolFile = () => {
    this.setState({addNewContractFileVisible: true});
  }
  handleContractNameChange = (value) => {
    this.state.newContractFileName = value;
  }
  handleContractAccountNameChange = (value) => {
    this.setState({newContractAccountName: value});
  }
  handleContractPublicKeyChange = (value) => {
    this.setState({newContractPublicKey: value});
  }
  handleFTAmountChange = (value) => {
    this.setState({ftAmount: value});
  }
  handlePasswordChange = (v) => {
    this.state.password = v;
  }
  onAddNewContractFileOK = () => {
    if (!this.state.newContractFileName.endsWith('.sol')) {
      this.state.newContractFileName = this.state.newContractFileName + '.sol';
    }
    let exist = false;
    this.state.solFileList.map(contractFileName => {
      if (this.state.newContractFileName == contractFileName) {
        exist = true;
      }
    });
    if (exist) {
      Message.error('文件已存在！');
      return;
    }

    this.state.solFileList.push(this.state.newContractFileName);
    this.setState({solFileList: this.state.solFileList, activeKey: this.state.newContractFileName, addNewContractFileVisible: false});
    this.addSolTab(this.state.newContractFileName);
    CompilerSrv.addSol(this.state.selectedAccountAddress, this.state.newContractFileName);
  }

  onAddNewContractFileClose = () => {
    this.setState({addNewContractFileVisible: false});
  }

  handleCompileSrvChange = (v) => {
    this.state.compileSrv = v;
  }

  onSetCompileSrvOK = () => {
    if (utils.isEmptyObj(this.state.compileSrv)) {
      Message.error('请输入编译服务器地址');
      return;
    }
    Message.success('编译服务器地址修改成功');
    global.localStorage.setItem('compileSrv', this.state.compileSrv);
    this.setState({compileSrvSettingVisible: false});
  }

  onSetCompileSrvClose = () => {
    this.setState({compileSrvSettingVisible: false});
  }  

  onAddContractABIOK = () => {
    if (!utils.isEmptyObj(this.state.contractABI) && !hyperchain.utils.isValidABI(this.state.contractABI)) {
      Message.error(T('ABI信息不符合规范，请检查后重新输入'));
      return;
    }
    utils.storeContractABI(this.state.loadedContractAddress, JSON.parse(this.state.contractABI));
    const contractName = this.getContractName(this.state.loadedContractAddress);
    this.displayContractFunc(this.state.loadedContractAddress, utils.isEmptyObj(contractName) ? 'tmpName-' + utils.getRandomInt(10000) : contractName , JSON.parse(this.state.contractABI));
    this.setState({ contractInfoVisible: false });
  }

  onAddContractABIClose = () => {
    this.setState({ contractInfoVisible: false });
  }

  handleContractABIChange = (value) => {
    this.state.contractABI = value;
  }

  storeContractName = (contractAddress, contractName) => {
    let storedName = utils.getDataFromFile(Constant.ContractNameFile);
    if (storedName != null) {
      storedName[contractAddress] = contractName;
    } else {
      storedName = {};
      storedName[contractAddress] = contractName;
    }
    utils.storeDataToFile(Constant.ContractNameFile, storedName);
  }
  
  getContractName = (contractAddress) => {
    let storedName = utils.getDataFromFile(Constant.ContractNameFile);
    if (storedName != null) {
      return storedName[contractAddress];
    }
    return null;
  }

  processContractDepolyed = (contractAddress, contractName, contractAbi) => {
    if (this.checkABI(contractAbi)) {
      this.displayContractFunc(contractAddress, contractName, contractAbi);
      this.storeContractName(contractAddress, contractName);
      utils.storeContractABI(contractAddress, contractAbi);
    }
  }

  displayContractFunc = (contractAddress, contractName, contractAbi) => {
    this.state.contractAccountInfo = [{contractAddress, contractName, contractAbi, genTime:new Date().toLocaleString()}, ...this.state.contractAccountInfo];
    this.setState({contractAccountInfo: this.state.contractAccountInfo});
  }
  
  processContractUpdated = (contractAddress, contractName, contractAbi) => {
    if (this.checkABI(contractAbi)) {
      this.replaceContractFunc(contractAddress, contractName, contractAbi);
      this.storeContractName(contractAddress, contractName);
      utils.storeContractABI(contractAddress, contractAbi);
    }
  }

  replaceContractFunc = (contractAddress, contractName, contractAbi) => {
    this.state.contractAccountInfo = this.state.contractAccountInfo.filter((item, index) => item.contractAddress != contractAddress);
    this.state.contractAccountInfo = [{contractAddress, contractName, contractAbi, genTime:new Date().toLocaleString()}, ...this.state.contractAccountInfo];    
    contractAbi.map(interfaceInfo => {
      if (interfaceInfo.type === 'function') {
        const funcName = interfaceInfo.name;
        this.state.result[contractAddress + funcName] = '';
        if (!interfaceInfo.constant) {
          this.state.result[contractAddress + funcName + 'TxReceipt'] = '';
        }
      }
    });
    
    this.setState({contractAccountInfo: this.state.contractAccountInfo});
  }

  onDeployContractClose = () => {
    this.setState({deployContractVisible: false});
  }
  delSolFile = () => {
    if (this.state.selectContactFile.length > 0) {
      const index = this.state.solFileList.indexOf(this.state.selectContactFile);
      if (index > -1) {
        this.state.solFileList.splice(index, 1);
        this.setState({solFileList: this.state.solFileList});
        this.delSolTab(this.state.selectContactFile);
        CompilerSrv.delSol(this.state.selectedAccountAddress, this.state.selectContactFile);
      }
    }
  }

  shareCode = () => {
    Dialog.confirm({
      title: '分享您的合约代码',
      content: '确认分享后，您在本IDE中的编码将通过类似直播的方式被分享出去。',
      messageProps:{
          type: 'success'
      },
      okProps: {children: '分享代码', className: 'unknown'},
      onOk: () => {this.shareCodeTx();},
      onCancel: () => { }
    });
  }

  shareCodeTx = () => {

  }

  selectShareCodeAccount = (v) => {
    this.state.selectedSharedAddress = v;
  }

  syncContracts = () => {
    if (utils.isEmptyObj(this.state.selectedSharedAddress)) {
      Message.error('请先选择需要同步的合约地址');
      return;
    }
  }

  onRightClick(info) {
    console.log('onRightClick', info);
  }

  signTxAndSend = (txInfo) => {
    const ethersKSInfo = this.state.keystoreInfo[txInfo.from];
    const privateKey = ethersKSInfo.privateKey;
    Message.success('正在发起交易');
    
    if (this.state.method === ActionType.DeployContract) {
      hyperchain.contract.deployContract(txInfo, privateKey).then(txHash => {
        this.addLog('交易hash:' + txHash);
        const syncTxTimeoutId = setTimeout(() => { 
          hyperchain.transaction.getTransactionReceipt(txHash).then(receipt => {
            clearTimeout(syncTxTimeoutId);
            this.addLog('交易receipt:' + JSON.stringify(receipt));
            const contractAddr = receipt.contractAddress;
            const success = receipt.valid;
            if (success) {
              Message.success('合约部署成功');
              this.addLog('合约部署成功');
              this.processContractDepolyed(contractAddr, this.state.curContractName, this.state.curContractABI)
            } else {
              Message.error('合约部署失败:' + receipt.errorMsg); 
              this.addLog('合约部署失败:' + receipt.errorMsg); 
            }
          }).catch (error => { 
            Message.error(error); 
            this.addLog(error);
          });
        }, 1000);
      }).catch (error => { 
        Message.error(error); 
        this.addLog(error);
      });
      
    } else if (this.state.method === ActionType.InvokeContract) {
      hyperchain.contract.invokeContract(txInfo, privateKey).then(result => {
        if (txInfo.simulate) {
          this.addLog('结果:' + JSON.stringify(result));
          const ret = utils.parseResult(this.state.funcResultOutputs[this.state.curContractAddress][this.state.curCallFuncName], result.ret);
          this.state.result[this.state.curContractAddress + this.state.curCallFuncName] = JSON.stringify(ret);
          this.setState({result: this.state.result});
          return;
        };
        this.addLog('交易hash:' + result);
        this.state.result[this.state.curContractAddress + this.state.curCallFuncName] = result;
        this.setState({result: this.state.result});
        const syncTxTimeoutId = setTimeout(() => { 
          hyperchain.transaction.getTransactionReceipt(result).then(receipt => {
            clearTimeout(syncTxTimeoutId);
            this.addLog('交易receipt:' + JSON.stringify(receipt));
            this.state.result[this.state.curContractAddress + this.state.curCallFuncName + 'TxReceipt'] = JSON.stringify(receipt);
            this.setState({result: this.state.result});
          }).catch (error => { 
            Message.error(error); 
            this.addLog(error);
          });
        }, 1000);
      }).catch (error => { 
        Message.error(error); 
        this.addLog(error);
      });
    } else if (this.state.method === ActionType.UpdateContract) {
      hyperchain.contract.maintainContract(txInfo, privateKey).then(txHash => {            
        this.addLog('交易hash:' + txHash);
        const syncTxTimeoutId = setTimeout(() => { 
          hyperchain.transaction.getTransactionReceipt(txHash).then(receipt => {
            clearTimeout(syncTxTimeoutId);
            this.addLog('交易receipt:' + JSON.stringify(receipt));
            const success = receipt.valid;
            if (success) {
              Message.success('合约更新成功');
              this.addLog('合约更新成功');
              this.processContractUpdated(txInfo.to, this.state.curContractName, this.state.curContractABI)
            } else {
              Message.error('合约更新失败:' + receipt.errorMsg); 
              this.addLog('合约更新失败:' + receipt.errorMsg);
            }
          }).catch (error => { 
            Message.error(error); 
            this.addLog(error);
          });
        }, 1000);
      }).catch (error => { 
        Message.error(error); 
        this.addLog(error);
      });
    }
  }

  onPwdOK = () => {
    if(!utils.checkPassword(this.state.password)) {
      Message.error(T('密码格式无效！'));
      return;
    }
    this.signTxAndSend(this.state.txInfo);    
    this.onPwdClose();
  }

  onPwdClose = () => {
    this.setState({
      pwdDialogVisible: false,
    });
  };

  render() {
    global.localStorage.setItem("solFileList", this.state.solFileList);
    const self = this;
    return (
      <div>
        <Row className="custom-row">
            <Col fixedSpan="11" className="custom-col-left-sidebar">
              <br />
              <Button type="primary" onClick={this.addSolFile}>添加合约</Button>
              &nbsp;&nbsp;
              <Button type="primary" onClick={this.delSolFile}>删除选中合约</Button>
              <br /><br />
              <Button type="primary" onClick={this.shareCode.bind(this)}>{T("分享我的合约")}</Button>
              <Tree editable showLine draggable selectable
                  defaultExpandedKeys={['0', '1', '2']}
                  onEditFinish={this.onEditFinish.bind(this)}
                  onRightClick={this.onRightClick}
                  onSelect={this.onSelectSolFile}>
                  <TreeNode key="0" label="我的合约" selectable={false}>
                    {
                      this.state.solFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
                  
                  <TreeNode key="1" label="公共库(可直接调用)" selectable={false}>
                    {
                      this.state.libFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
                  
                  <TreeNode key="2" label="示例(仅供参考)" selectable={false}>
                    {
                      this.state.smapleFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
              </Tree>
              <br /><br />
              <Select
                  style={{ width: '90%' }}
                  placeholder={T("分享合约的地址列表")}
                  onChange={this.selectShareCodeAccount.bind(this)}
                  dataSource={this.state.accountsOfShareCode}
                />
              <br /><br />
              <Button type="primary" onClick={this.syncContracts.bind(this)}>{T("同步合约")}</Button>
              <Tree editable showLine draggable selectable
                  defaultExpandedKeys={['0']}
                  onRightClick={this.onRightClick}
                  onSelect={this.onSelectSolFile}>
                  <TreeNode key="0" label="xxx分享的合约" selectable={false}>
                    {
                      this.state.solFileList.map(solFile => <TreeNode key={solFile} label={solFile}/>)
                    }
                  </TreeNode>
              </Tree>
            </Col>
            <Col className="custom-col-content">
              <Tab activeKey={this.state.activeKey} excessMode="slide" onClose={this.onClose.bind(this)} onClick={this.selectTab}>
                {
                  this.state.tabFileList.map(fileName =>
                          <Tab.Item closeable={true} key={fileName} title={fileName} tabStyle={{ height:'20px',opacity:0.2}}>
                            <ContractEditor fileName={fileName} accountName={this.state.selectedAccountAddress}/>
                          </Tab.Item>
                  )
                }
              </Tab>
              
              <br />
              <br />
              <Input.TextArea hasClear
                autoHeight={{ minRows: 20, maxRows: 20 }} 
                value={this.state.resultInfo}
                size="medium"
                onChange={this.changeLog.bind(this)}
              />
              <br />
              <br />  
              <Input hasClear
                  onChange={this.handleContractNoChange.bind(this)}
                  style={{ width: 220 }}
                  addonTextBefore={T("编号")}
                  size="medium"
                />
              &nbsp;&nbsp;&nbsp;
              <Button type="primary" onClick={this.removeContractCall.bind(this)}>{T("删除")}</Button>
              <br />  
              <br />     
              <ContractCollapse self={self} contractAccountInfo={this.state.contractAccountInfo}/>
            </Col>
            <Col fixedSpan="15" className="custom-col-right-sidebar">
              <Row style={{width: '100%', color: '#fff'}} justify="space-between">
                地址:
              </Row>
              <Row style={{width: '100%'}}>
                <Select
                  style={{ width: 170 }}
                  placeholder={T("选择发起合约操作的账户")}
                  onChange={this.onChangeAddress.bind(this)}
                  defaultValue={this.state.addresses.length > 0 ? this.state.addresses[0].label : ''}
                  dataSource={this.state.addresses}
                />
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.copyAddress.bind(this)}>{T("复制")}</Button>
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.addAddress.bind(this)}>{T("添加")}</Button>
              </Row>
              <br/>
              <Row style={{width: '100%'}}>
                <Select
                  style={{ width: 170 }}
                  placeholder={T("请选择待编译文件")}
                  onChange={this.onChangeContractFile.bind(this)}
                  value={this.state.selectedFileToCompile}
                  dataSource={this.state.solFileList}
                />
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.compileContract.bind(this)}>{T("编译")}</Button>
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.setCompileSrv.bind(this)}>{T("配置")}</Button>
              </Row>
              <br/><br/>
              <Row style={{width:'100%'}}>
                <Select
                  style={{ width: '100%' }}
                  placeholder={T("请选择合约")}
                  onChange={this.onChangeContract.bind(this)}
                  dataSource={this.state.contractList}
                />
              </Row>
              <br/>
              <Row style={{width:'100%'}}>
                <Button type="primary" onClick={this.getAbi.bind(this)}>{T("查看ABI")}</Button>
                &nbsp;&nbsp;
                <Button type="primary" onClick={this.getBin.bind(this)}>{T("查看BIN")}</Button>
                &nbsp;&nbsp;
                <Button type="primary" onClick={this.deployContract.bind(this)}>{T("部署")}</Button>
                &nbsp;&nbsp;
                <Button type="primary" onClick={this.updateContract.bind(this)}>{T("更新合约")}</Button>
              </Row>
              <br/>
              <Row style={{width:'100%'}}>
                <Input hasClear
                  onChange={this.handleLoadedContractAddressChange.bind(this)}
                  value={this.state.loadedContractAddress}
                  style={{ width: 240 }}
                  addonTextBefore={T("合约地址")}
                  size="medium"
                />
                &nbsp;&nbsp;&nbsp;
                <Button type="primary" onClick={this.loadContract.bind(this)}>{T("加载")}</Button>
              </Row>
              <br/>
              {
                this.state.constructorParaNames.length > 0 ? 
                <Card style={{ width: '100%', marginBottom: "10px" }} bodyHeight="auto" title="构造函数">
                  <Parameters self={this} width='100%' contractAddress={this.state.curContractName} funcName='constructor' 
                    parameterNames={this.state.constructorParaNames} parameterTypes={this.state.constructorParaTypes} />
                </Card> : ''
              }
             
            </Col>
        </Row>
        
        <br />
        <br />
        <Dialog
          visible={this.state.addNewContractFileVisible}
          title={T("请输入合约文件名称")}
          closeable="true"
          footerAlign="center"
          onOk={this.onAddNewContractFileOK.bind(this)}
          onCancel={this.onAddNewContractFileClose.bind(this)}
          onClose={this.onAddNewContractFileClose.bind(this)}
        >
          <Input hasClear
            onChange={this.handleContractNameChange.bind(this)}
            onPressEnter={this.onAddNewContractFileOK.bind(this)}
            style={{ width: 200 }}
            addonTextBefore={T("合约文件名")}
            size="medium"
          />
        </Dialog>
        
        <Dialog closeable='close,esc,mask'
          visible={this.state.compileSrvSettingVisible}
          title={T("请输入编译服务器地址")}
          closeable="true"
          footerAlign="center"
          onOk={this.onSetCompileSrvOK.bind(this)}
          onCancel={this.onSetCompileSrvClose.bind(this)}
          onClose={this.onSetCompileSrvClose.bind(this)}
        >
          <Input hasClear
            onChange={this.handleCompileSrvChange.bind(this)}
            style={{ width: 350 }}
            addonTextBefore={T("编译服务器地址")}
            size="medium"
          />
          <br />
          {
            !utils.isEmptyObj(this.state.compileSrv) && this.state.compileSrv != 'http://52.194.255.222:8081'  
              ? '当前服务器地址:' + this.state.compileSrv : ''
          }
          <br />
          默认服务器地址:http://52.194.255.222:8081
        </Dialog>
        <Dialog closeable='close,esc,mask'
          visible={this.state.contractInfoVisible}
          title={T("本地添加合约ABI信息")}
          footerAlign="center"
          onOk={this.onAddContractABIOK.bind(this)}
          onCancel={this.onAddContractABIClose.bind(this)}
          onClose={this.onAddContractABIClose.bind(this)}
        >
          <Input hasClear multiple
            onChange={this.handleContractABIChange.bind(this)}
            style={{ width: 400 }}
            addonTextBefore={T("ABI信息")}
            size="medium"
            defaultValue={this.state.originalABI}
            hasLimitHint
          />
        </Dialog>
        <Dialog closeable='close,esc,mask'
          visible={this.state.displayAbiVisible}
          title={T("合约ABI信息")}
          footerAlign="center"
          onOk={this.onDisplayABIOK.bind(this)}
          onCancel={this.onDisplayABIClose.bind(this)}
          onClose={this.onDisplayABIClose.bind(this)}
          okProps={{children: '复制ABI'}}
        >
          <ReactJson src={this.state.curAbi}/>
        </Dialog>

        <Dialog closeable='close,esc,mask'
          style={{ width: '500px' }}
          visible={this.state.displayBinVisible}
          title={T("合约BIN信息")}
          footerAlign="center"
          onOk={this.onDisplayBINOK.bind(this)}
          onCancel={this.onDisplayBINClose.bind(this)}
          onClose={this.onDisplayBINClose.bind(this)}
          okProps={{children: '复制BIN'}}
        >
          <IceEllipsis lineNumber={10} text= {this.state.curBin} />
        </Dialog>
        <Dialog
          visible={this.state.pwdDialogVisible}
          onOk={this.onPwdOK.bind(this)}
          onCancel={this.onPwdClose}
          onClose={this.onPwdClose}
          title={T("输入密码")}
          footerAlign="center"
        >
          <Input hasClear
            htmlType="password"
            onChange={this.handlePasswordChange.bind(this)}
            style={{ width: 400 }}
            addonTextBefore={T("密码")}
            placeholder={T(pwdPlaceholder)}
            size="medium"
            defaultValue=""
            maxLength={20}
            hasLimitHint
            onPressEnter={this.onPwdOK.bind(this)}
          />
          <br/>
          <br/>
          注意:刷新/切换/关闭本页面后，需重新输入密码
        </Dialog>
      </div>
    );
  }
}
