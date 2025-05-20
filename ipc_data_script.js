const axios = require('axios');
const fs = require('fs');
const ipcData = require('./ipc_data.js');

// 请求头配置
const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Authorization': 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyaW5mbyI6IntcImNvbW1lbnRzXCI6XCJcIixcImNvbnRyYWN0SWRcIjo1ODcsXCJjcmVhdGVCeVwiOjcwNzQsXCJjcmVhdGVUaW1lXCI6XCIyMDIzLTA5LTIxIDE1OjA4OjA0XCIsXCJjcmVhdGVVc2VyXCI6XCJ6aGFuZ2NodW5taW5nXCIsXCJleGFtaW5lckhhc1JvbGVcIjoxLFwiZXhwaXJlRGF0ZVwiOlwiMjAyNi0wOS0zMCAyMzo1OTo1OVwiLFwiZXh0ZW5kVmVyc2lvbnNcIjpbMSwyLDZdLFwiZnJvbUJpbmRDb21wYW55XCI6ZmFsc2UsXCJmcm9tU2FtZUNpdHlcIjpmYWxzZSxcImlkXCI6NjY4MDgsXCJsaW5rVG9rZW5Mb2dpblwiOnRydWUsXCJsb2NrVGltZVwiOjYwLFwibWFya3NcIjpcIjIxOS4xNDIuMS4xNjJcIixcIm5hbWVcIjpcIumSn-S4u-S7u1wiLFwibmVlZFNlbmRFbWFpbFwiOnRydWUsXCJuZWVkU2VuZFdlQ2hhdFwiOnRydWUsXCJvcGVuTnVtYmVyXCI6MyxcIm9yZGVyVHlwZVwiOjEsXCJwYWdlTm9cIjoxLFwicGFnZVNpemVcIjoxMCxcInBhc3N3b3JkXCI6XCI5NjBhOTFiNTBlNGVkNDQxMWJmNDRhNjc2NGU5NzU1NzQwNGMwMDA3NTdhMGI5MDhcIixcInBhc3N3b3JkTmVlZFwiOnRydWUsXCJwaG9uZVwiOlwiMDEwLTg4ODI4NjcwXCIsXCJyZWdpc3RlcmVkRnJvbVwiOlwiSElNTVBBVF9VU0VSX0FERFwiLFwicmVsQ3JlYXRlVXNlclwiOlwiemhhbmdjaHVubWluZ1wiLFwic2FsZXNcIjpcIjcwNzRcIixcInNxdWVlemVcIjpcIjFcIixcInN0YXJ0Um93XCI6MCxcInN0YXJ0VGltZVwiOlwiMjAyMy0wOS0yMSAwMDowMDowMFwiLFwic3lzVmVyc2lvblwiOjAsXCJ1c2VBZGRUaW1lXCI6ZmFsc2UsXCJ1c2VyQ2xhc3NcIjoxLFwidXNlck5hbWVcIjpcImhneTVcIixcInVzZXJTdGF0dXNcIjpcIjFcIixcInVzZXJUeXBlXCI6MixcInVzZXJUeXBlQWxsXCI6WzJdLFwidXNlclR5cGVPbGRcIjoyLFwidXNlclR5cGVSZWxcIjoyLFwidmVyc2lvblwiOjJ9IiwiZXhwIjoxNzUwMzEwMTM0fQ.Suu4qNHiD_GZcAVALDcBlicfcgF79hNSye6WljsbfGQHIMMUC1',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'Origin': 'https://www.himmpat.com',
    'Referer': 'https://www.himmpat.com/list?targetPage=%2Fadvanced&localId=6c9ec178d73a3b0f1794ce592f5ceb19',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'isAgain': 'true',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sourcePage': '/',
    'targetPage': '/list'
};

// 基础请求体
const baseRequestBody = {
    "countrys": [
        "[\"A\",\"U\",\"B\",\"D\"]",
        "[\"CN\",\"US\",\"EP\",\"JP\",\"KR\",\"WO\",\"DE\",\"GB\",\"FR\",\"CA\",\"AU\",\"TW\",\"ES\",\"RU\",\"IT\",\"IN\",\"SU\",\"EU\",\"AT\",\"BR\",\"SE\",\"CH\",\"TR\",\"BE\",\"ZA\",\"FI\",\"NL\",\"NO\",\"DK\",\"HK\",\"IL\",\"PL\",\"MX\",\"HU\",\"UA\",\"AR\",\"DD\",\"CZ\",\"PT\",\"CS\",\"GR\",\"NZ\",\"RO\",\"SG\",\"IE\",\"MY\",\"EA\",\"PH\",\"YU\",\"MA\",\"LU\",\"SI\",\"BG\",\"HR\",\"SK\",\"PE\",\"CL\",\"CO\",\"RS\",\"AP\",\"TN\",\"LT\",\"MD\",\"OA\",\"EC\",\"BX\",\"UY\",\"CY\",\"IS\",\"ID\",\"LV\",\"EG\",\"CR\",\"GE\",\"EE\",\"SA\",\"AL\",\"CU\",\"JO\",\"GT\",\"DO\",\"MC\",\"SY\",\"SM\",\"ME\",\"AE\",\"MT\",\"ZM\",\"ZW\",\"HN\",\"PA\",\"BO\",\"NI\",\"SV\",\"DZ\",\"BN\",\"KE\",\"LA\",\"BH\",\"MK\",\"BA\",\"BD\",\"KH\",\"PY\",\"MW\",\"VE\",\"PG\",\"NG\",\"AW\",\"TJ\",\"GC\",\"AO\",\"MN\",\"VN\",\"IQ\",\"LB\",\"PK\",\"XK\",\"KZ\",\"BY\",\"QA\",\"SD\",\"BZ\",\"BS\",\"MS\",\"GY\",\"TM\",\"BM\",\"SB\",\"UZ\",\"KY\",\"BB\",\"VG\",\"BW\",\"TH\",\"TZ\",\"AI\",\"LK\",\"JE\",\"KG\",\"SC\",\"VC\",\"AM\",\"NA\",\"FJ\",\"OM\",\"RW\",\"ZN\",\"DM\",\"PS\",\"AG\",\"DJ\",\"ET\",\"MU\",\"TT\",\"MZ\",\"AD\",\"AZ\",\"BT\",\"CD\",\"CG\",\"CV\",\"GH\",\"IR\",\"MG\",\"MM\",\"MO\",\"ST\",\"UG\",\"YE\",\"TO\",\"TC\"]"
    ],
    "pageNo": 1,
    "itemId": 0,
    "isInsertHis": 0,
    "refreshCountry": true,
    "pageSize": "100",
    "defaultField": "all/",
    "historyId": 27229249,
    "ignoreJoinSpace": 0,
    "orderBy": ["QUANTITY_FAMCTRY_EX"],
    "orderType": [1],
    "currentTime": "2025-05-20 14:28:24",
    "fieldsList": [
        "pn","title","appNumber","AP_ORIGINAL_KEY","in_original","agc_original","prid","pd","stat","patstat","lsclass_last_cn","ipc","LOC","ab","famexCntys","appDate","pctan","sti","ASG_ORIGINAL_KEY"
    ],
    "mergeType": "AN",
    "retainType": "PD asc",
    "retainTypeSecound": "PD asc",
    "queryGeneralScreens": ["AND 2024/apd"],
    "langs": ["0","2","1"],
    "readType": "2",
    "needAsync": "1",
    "statisticsSubCode": "NORM_AP_KEY",
    "statisticsCode": "APA"
};

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 获取单个IPC分类号的数据
async function getIpcData(ipcCode, retryCount = 3) {
    const requestBody = {
        ...baseRequestBody,
        query: `${ipcCode}/ic`
    };

    for (let i = 0; i < retryCount; i++) {
        try {
            const response = await axios.post(
                'https://www.himmpat.com/api/v4.9.0/service/query/advancedQuery',
                requestBody,
                { headers }
            );
            if (response.data && response.data.data && response.data.data.facetRestult && response.data.data.facetRestult.NORM_AP_KEY) {
                return response.data.data.facetRestult.NORM_AP_KEY.length;
            } else if (response.data && response.data.code === 20009) {
                console.log('遇到错误码20009，等待70秒并保存数据...');
                const tempData = `const ipcData = ${JSON.stringify(ipcData, null, 2)};\n\nmodule.exports = ipcData;`;
                fs.writeFileSync('ipc_data_updated.js', tempData);
                await delay(70000);
                continue;
            } else if(!response.data?.data?.facetRestult?.NORM_AP_KEY){
                return 0;
            } else {
                console.error(`响应格式不正确 (尝试 ${i + 1}/${retryCount}):`, JSON.stringify(response.data, null, 2));
                if (i < retryCount - 1) {
                    await delay(2000); // 失败后等待2秒再重试
                    continue;
                }
                throw new Error('响应格式不正确');
            }
        } catch (error) {
            console.error(`请求失败 (尝试 ${i + 1}/${retryCount}):`, error.message);
            if (i < retryCount - 1) {
                await delay(2000);
                continue;
            }
            throw error;
        }
    }
}

// 主函数
async function main() {
    const ipcCodes = Object.keys(ipcData);
    console.log(`开始处理 ${ipcCodes.length} 个IPC分类号...`);

    for (let i = 0; i < ipcCodes.length; i++) {
        const ipcCode = ipcCodes[i];
        console.log(`正在处理 ${i + 1}/${ipcCodes.length}: ${ipcCode}`);

        try {
            const totalNumber = await getIpcData(ipcCode);
            ipcData[ipcCode]["2024personSum"] = totalNumber;
            console.log(`${ipcCode} 更新成功: ${totalNumber}`);
        } catch (error) {
            console.error(`获取 ${ipcCode} 数据失败: ${error.message}`);
            // 如果失败，等待3秒后继续
            console.log('等待3秒后继续...');
            await delay(3000);
            i--; // 重试当前项
            continue;
        }
    }

    // 保存最终更新后的数据
    const updatedData = `const ipcData = ${JSON.stringify(ipcData, null, 2)};\n\nmodule.exports = ipcData;`;
    fs.writeFileSync('ipc_data_updated.js', updatedData);
    console.log('数据已保存到 ipc_data_updated.js');
}

main().catch(console.error);