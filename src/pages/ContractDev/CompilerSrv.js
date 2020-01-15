const compileSrvAddr = "http://sol0511Srv2.xchainunion.com";
const chainName = 'ethereum';
let userFileAddr = compileSrvAddr + "/solidity/";
let libFileAddr = compileSrvAddr + "/libsList/?" + chainName;
let sampleFileAddr = compileSrvAddr + "/sampleCodeList/?" + chainName;


const  OpSolType = {
	AddSol: 0,
	DelSol :  1,
	UpdateSol :  2,
	ListSol :  3,
	RenameSol :  4,
	CompileSol :  5,
	ListSharedAccount :  6,
	GetSharedSol :  7,
}

export function changeSrv(compileSrv) {
  userFileAddr = compileSrv + '/solidity/';
  libFileAddr = compileSrv + '/libsList/';
  sampleFileAddr = compileSrv + '/sampleCodeList/';
}

export async function getLibSolFile() {
  let resp = await fetch(libFileAddr, {});
  resp = await resp.json();
  return resp;
}

export async function getSampleSolFile() {
  let resp = await fetch(sampleFileAddr, {});
  resp = await resp.json();
  return resp;
}

export function addSol(accountName, solFileName) {
  const dataToSrv = JSON.stringify({ type: OpSolType.AddSol,
    chainName,
    accountName,
    sharedAccountName: '',
    solFileName,
    newSolFileName: "",
    solFileContent: ""});
  fetch(userFileAddr, 
        {headers: { "Content-Type": "application/json" }, method: 'POST', body: dataToSrv})
  .then(resp => {
          resp.json().then(response => console.log(response));
        });
}

export function delSol(accountName, solFileName) {
  const dataToSrv = JSON.stringify({ type: OpSolType.DelSol,
    chainName,
    accountName,
    sharedAccountName: '',
    solFileName,
    newSolFileName: "",
    solFileContent: ""});
  fetch(userFileAddr, 
        {headers: { "Content-Type": "application/json" }, method: 'POST', body: dataToSrv})
  .then(resp => {
          resp.json().then(response => console.log(response));
        });
}

export function updateSol(accountName, solFileName, solFileContent) {
  const dataToSrv = JSON.stringify({ type: OpSolType.UpdateSol,
    chainName,
    accountName,
    sharedAccountName: '',
    solFileName,
    newSolFileName: "",
    solFileContent});
  fetch(userFileAddr, 
        {headers: { "Content-Type": "application/json" }, method: 'POST', body: dataToSrv})
  .then(resp => {
          resp.json().then(response => console.log(response));
        });
}

export async function listSol(accountName) {
  const dataToSrv = JSON.stringify({ type: OpSolType.ListSol,
    chainName,
    accountName,
    sharedAccountName: '',
    solFileName: "",
    newSolFileName: "",
    solFileContent: ""});
  let resp = await fetch(userFileAddr, 
        {headers: { "Content-Type": "application/json" }, method: 'POST', body: dataToSrv});
  resp = await resp.json();
  console.log(resp);
  return resp;
}

export function renameSol(accountName, solFileName, newSolFileName) {
  const dataToSrv = JSON.stringify({ type: OpSolType.RenameSol,
    chainName,
    accountName,
    sharedAccountName: '',
    solFileName,
    newSolFileName,
    solFileContent: ""});
  fetch(userFileAddr, 
        {headers: { "Content-Type": "application/json" }, method: 'POST', body: dataToSrv})
  .then(resp => {
          resp.json().then(response => console.log(response));
        });
}

export async function compileSol(accountName, solFileName) {
  const dataToSrv = JSON.stringify({ type: OpSolType.CompileSol,
    chainName,
    accountName,
    sharedAccountName: '',
    solFileName,
    newSolFileName: "",
    solFileContent: ""});
  let resp = await fetch(userFileAddr, 
      {headers: { "Content-Type": "application/json" }, method: 'POST', body: dataToSrv});
  resp = await resp.json();
  console.log(resp);
  return resp;
}

export async function listSharedSol(accountName, sharedAccountName) {
  const dataToSrv = JSON.stringify({ type: OpSolType.ListSharedAccount,
    chainName,
    accountName,
    sharedAccountName,
    solFileName,
    newSolFileName: "",
    solFileContent: ""});
  let resp = await fetch(userFileAddr, 
      {headers: { "Content-Type": "application/json" }, method: 'POST', body: dataToSrv});
  resp = await resp.json();
  console.log(resp);
  return resp;
}

export async function getSharedSol(accountName, sharedAccountName, solFileName) {
  const dataToSrv = JSON.stringify({ type: OpSolType.GetSharedSol,
    chainName,
    accountName,
    sharedAccountName,
    solFileName,
    newSolFileName: "",
    solFileContent: ""});
  let resp = await fetch(userFileAddr, 
      {headers: { "Content-Type": "application/json" }, method: 'POST', body: dataToSrv});
  resp = await resp.json();
  console.log(resp);
  return resp;
}