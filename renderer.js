const { contextBridge, ipcRenderer } = require('electron')
// const { PythonShell } = require('python-shell');
// contextBridge.exposeInMainWorld('versions', {
//   node: () => process.versions.node,
//   chrome: () => process.versions.chrome,
//   electron: () => process.versions.electron,
//   ping: () => ipcRenderer.invoke('ping')
//   // 除函数之外，我们也可以暴露变量
// })


// document.getElementById('fetchData').addEventListener('click', async () => {
//     const searchId = document.getElementById('searchId').value;

//     // 获取当前时间并格式化为所需的字符串格式（北京时间）
//     const currentTime = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19); // 格式化为 YYYY-MM-DD HH:mm:ss

//     const allData = []; // 用于存储所有数据
//     let pageNo = 1; // 初始化页码
//     let hasMoreData = false; // 标记是否还有更多数据 todo

//     while (hasMoreData) {
//         const requestData = {
//             orderType: [0],
//             orderBy: ["default"],
//             queryParam: [],
//             pageNo: pageNo, // 使用当前页码
//             pageSize: 100, // 每页大小,100是接口支持的最大值
//             countrys: [
//                 "[\"A\",\"U\",\"B\",\"D\"]",
//                 "[\"CN\",\"US\",\"EP\",\"JP\",\"KR\",\"WO\",\"DE\",\"GB\",\"FR\",\"CA\",\"AU\",\"TW\",\"ES\",\"RU\",\"IT\",\"IN\",\"SU\",\"EU\",\"AT\",\"BR\",\"SE\",\"CH\",\"TR\",\"BE\",\"ZA\",\"FI\",\"NL\",\"NO\",\"DK\",\"HK\",\"IL\",\"PL\",\"MX\",\"HU\",\"UA\",\"AR\",\"DD\",\"CZ\",\"PT\",\"CS\",\"GR\",\"NZ\",\"RO\",\"SG\",\"IE\",\"MY\",\"EA\",\"PH\",\"YU\",\"MA\",\"LU\",\"SI\",\"BG\",\"HR\",\"SK\",\"PE\",\"CL\",\"CO\",\"RS\",\"AP\",\"TN\",\"LT\",\"MD\",\"OA\",\"EC\",\"BX\",\"UY\",\"CY\",\"IS\",\"ID\",\"LV\",\"EG\",\"CR\",\"GE\",\"EE\",\"SA\",\"AL\",\"CU\",\"JO\",\"GT\",\"DO\",\"MC\",\"SY\",\"SM\",\"ME\",\"AE\",\"MT\",\"ZM\",\"ZW\",\"HN\",\"PA\",\"BO\",\"NI\",\"SV\",\"DZ\",\"BN\",\"KE\",\"LA\",\"BH\",\"MK\",\"BA\",\"BD\",\"KH\",\"PY\",\"MW\",\"VE\",\"PG\",\"NG\",\"AW\",\"TJ\",\"GC\",\"AO\",\"MN\",\"VN\",\"IQ\",\"LB\",\"PK\",\"XK\",\"KZ\",\"BY\",\"QA\",\"SD\",\"BZ\",\"BS\",\"MS\",\"GY\",\"TM\",\"BM\",\"SB\",\"UZ\",\"KY\",\"BB\",\"VG\",\"BW\",\"TH\",\"TZ\",\"AI\",\"LK\",\"JE\",\"KG\",\"SC\",\"VC\",\"AM\",\"NA\",\"FJ\",\"OM\",\"RW\",\"ZN\",\"DM\",\"PS\",\"AG\",\"DJ\",\"ET\",\"MU\",\"TT\",\"MZ\",\"AD\",\"AZ\",\"BT\",\"CD\",\"CG\",\"CV\",\"GH\",\"IR\",\"MG\",\"MM\",\"MO\",\"ST\",\"UG\",\"YE\",\"TO\",\"TC\"]"
//             ],
//             priorityLang: "",
//             itemId: 0,
//             queryGeneralScreens: [],
//             query: searchId, // 将 searchId 放入 query 字段
//             isInsertHis: 0,
//             defaultField: "all/",
//             ignoreJoinSpace: 0,
//             currentTime: currentTime, // 使用格式化后的当前时间
//             fieldsList: [
//                 "pn", "title", "appNumber", "AP_ORIGINAL_KEY", "in_original", "agc_original", "prid", "pd", "stat", "patstat", "lsclass_last_cn", "ipc", "LOC", "ab", "famexCntys", "appDate", "pctan", "sti"
//             ],
//             mergeType: "FAM",
//             retainType: "PNCTRY CN US EP JP KR",
//             retainTypeSecound: "AD asc",
//             historyId: 25814967,
//             isPage: true, // 设置 isPage 为 true
//             langs: ["0", "2", "1"],
//             readType: "2"
//         };

//         try {
//             const response = await fetch('https://www.himmpat.com/api/v4.7.5/service/query/advancedQuery', {
//                 method: 'POST', // 使用 POST 方法
//                 headers: {
//                     'Accept': 'application/json, text/plain, */*',
//                     'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
//                     'Authorization': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyaW5mbyI6IntcImNvbW1lbnRzXCI6XCJcIixcImNvbnRyYWN0SWRcIjo1ODcsXCJjcmVhdGVCeVwiOjcwNzQsXCJjcmVhdGVUaW1lXCI6XCIyMDIzLTA5LTIxIDE1OjA4OjA0XCIsXCJjcmVhdGVVc2VyXCI6XCJ6aGFuZ2NodW5taW5nXCIsXCJleGFtaW5lckhhc1JvbGVcIjoxLFwiZXhwaXJlRGF0ZVwiOlwiMjAyNi0wOS0zMCAyMzo1OTo1OVwiLFwiZXh0ZW5kVmVyc2lvbnNcIjpbMSwyLDZdLFwiZnJvbUJpbmRDb21wYW55XCI6ZmFsc2UsXCJmcm9tU2FtZUNpdHlcIjpmYWxzZSxcImlkXCI6NjY4MDgsXCJsaW5rVG9rZW5Mb2dpblwiOnRydWUsXCJsb2NrVGltZVwiOjYwLFwibWFya3NcIjpcIjIxOS4xNDIuMS4xNjJcIixcIm5hbWVcIjpcIumSn-S4u-S7u1wiLFwibmVlZFNlbmRFbWFpbFwiOnRydWUsXCJuZWVkU2VuZFdlQ2hhdFwiOnRydWUsXCJvcGVuTnVtYmVyXCI6MyxcIm9yZGVyVHlwZVwiOjEsXCJwYWdlTm9cIjoxLFwicGFnZVNpemVcIjoxMCxcInBhc3N3b3JkXCI6XCI5NjBhOTFiNTBlNGVkNDQxMWJmNDRhNjc2NGU5NzU1NzQwNGMwMDA3NTdhMGI5MDhcIixcInBhc3N3b3JkTmVlZFwiOnRydWUsXCJwaG9uZVwiOlwiMDEwLTg4ODI4NjcwXCIsXCJyZWdpc3RlcmVkRnJvbVwiOlwiSElNTVBBVF9VU0VSX0FERFwiLFwicmVsQ3JlYXRlVXNlclwiOlwiemhhbmdjaHVubWluZ1wiLFwic2FsZXNcIjpcIjcwNzRcIixcInNxdWVlemVcIjpcIjFcIixcInN0YXJ0Um93XCI6MCxcInN0YXJ0VGltZVwiOlwiMjAyMy0wOS0yMSAwMDowMDowMFwiLFwic3lzVmVyc2lvblwiOjAsXCJ1c2VBZGRUaW1lXCI6ZmFsc2UsXCJ1c2VyQ2xhc3NcIjoxLFwidXNlck5hbWVcIjpcImhneTVcIixcInVzZXJTdGF0dXNcIjpcIjFcIixcInVzZXJUeXBlXCI6MixcInVzZXJUeXBlQWxsXCI6WzJdLFwidXNlclR5cGVPbGRcIjoyLFwidXNlclR5cGVSZWxcIjoyLFwidmVyc2lvblwiOjJ9IiwiZXhwIjoxNzQ1NDcwMzg5fQ.TYhjSGwx5rYpUU4gJB7qdVslIGXXolJtHFEFYHTXtFkHIMMUC1',
//                     'Connection': 'keep-alive',
//                     'Content-Type': 'application/json',
//                     'Origin': 'https://www.himmpat.com',
//                     'Referer': 'https://www.himmpat.com/list?localId=79e721a66c7290e4c611968575dcd78e',
//                     'Sec-Fetch-Dest': 'empty',
//                     'Sec-Fetch-Mode': 'cors',
//                     'Sec-Fetch-Site': 'same-origin',
//                     'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
//                     'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
//                     'sec-ch-ua-mobile': '?0',
//                     'sec-ch-ua-platform': '"macOS"',
//                     'sourcePage': '/',
//                     'targetPage': '/list'
//                 },
//                 body: JSON.stringify(requestData) // 将请求数据转换为 JSON 字符串
//             });

//             if (!response.ok) {
//                 throw new Error('网络响应不正常');
//             }
//             const data = await response.json();
//             if(data.code === 20009){
//                 // 添加请求间隔，避免请求过于频繁
//                 await new Promise(resolve => setTimeout(resolve, 60000));
//             } else {
//                 allData.push(...data.data.list);
//                 hasMoreData = data.data.list?.length > 0; 
//                 pageNo++; // 增加页码以获取下一页数据
//             }
//         } catch (error) {
//             console.error('获取数据时出错:', error);
//             hasMoreData = false; // 如果出错，停止请求
//         }
//     }
//     console.log('====11', allData);
// });