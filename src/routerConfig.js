// 以下文件格式为描述路由的协议格式
// 你可以调整 routerConfig 里的内容
// 变量名 routerConfig 为 iceworks 检测关键字，请不要修改名称

import { getRouterData } from './utils/utils';
import { asideMenuConfig } from './menuConfig';

import BasicLayout from './layouts/BasicLayout';
import ContractDev from './pages/ContractDev';
import NotFound from './pages/NotFound';
import Dapp from './pages/Dapp';
import Study from './pages/Study';


const routerConfig = [
  {
    path: '/exception/404',
    component: NotFound,
    layout: BasicLayout,
  },
  {
    path: '/contractDev',
    layout: BasicLayout,
    component: ContractDev,
  },
  {
    path: '/study',
    layout: BasicLayout,
    component: Study,
  },
  {
    path: '/dapp',
    layout: BasicLayout,
    component: Dapp,
  },
];

const routerData = getRouterData(routerConfig, asideMenuConfig);

export { routerData };
