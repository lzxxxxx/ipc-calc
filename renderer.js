const { contextBridge, ipcRenderer } = require('electron')
const XLSX = require('xlsx')
const ipcData = require('./ipc_data.js')

// 需要分析ipc分类号的字段：
// 受理局 没有  apc
// 专利权人 和申请人好像是一样的？ gras
// 法律状态 是否有效 是否有权？ state
// 专利申请人 paas
// 专利是否有效 没有
// 

// 计算 B1.1 分数
function calculateB1_1(row) {
    const citedPatents = parseFloat(row['引文申请号数量'] || 0);
    const documentPages = parseFloat(row['文献页数'] || 1); // 避免除以0
    const score = (citedPatents / documentPages) * 5;
    return Math.min(score, 10); // 超过10分按10分算
}

// 计算 B1.2 分数
function calculateB1_2(row) {
    const independentClaim = row['独立权利要求-原文'] || '';
    const totalCount = independentClaim.length; // 独立权利要求总字数
    
    // 查找"其特征"在文本中的位置
    const featureIndex = independentClaim.indexOf('其特征');
    let featuresCount = 0;
    
    if (featureIndex !== -1) {
        // 如果找到"其特征"，计算其后面的字数
        featuresCount = totalCount - featureIndex;
    }
    
    // 避免除以0
    if (totalCount === 0) return 0;
    
    return (featuresCount / totalCount) * 10;
}

// 计算 B1.3 分数
function calculateB1_3(row) {
    const claimCount = parseFloat(row['权利要求数量'] || 0);
    return Math.min(claimCount, 10); // 最高10分
}

// 计算 B2.1 分数 (权利要求数量/文献页数)
function calculateB2_1(row) {
    const claimCount = parseFloat(row['权利要求数量'] || 0);
    const documentPages = parseFloat(row['文献页数'] || 1); // 避免除以0
    return Math.min(claimCount / documentPages * 10, 10);
}

// 计算 B2.2 分数 ((1 - 独立权利要求中"其特征"后面的字数/独立权利要求总字数)×10)
function calculateB2_2(row) {
    const independentClaim = row['独立权利要求-原文'] || '';
    const totalCount = independentClaim.length; // 独立权利要求总字数
    
    // 查找"其特征"在文本中的位置
    const featureIndex = independentClaim.indexOf('其特征');
    let featuresCount = 0;
    
    if (featureIndex !== -1) {
        // 如果找到"其特征"，计算其后面的字数
        featuresCount = totalCount - featureIndex;
    }
    
    // 避免除以0
    if (totalCount === 0) return 0;
    // 计算 (1 - 特征字数/总字数) × 10
    return (1 - featuresCount / totalCount) * 10;
}

// 计算专利不可规避性总分
function calculateUnavoidable(row) {
    const B2_1 = calculateB2_1(row);
    const B2_2 = calculateB2_2(row);
    return (B2_1 + B2_2) / 2;
}

// 计算多国申请分数
function calculateMultiCountry(row) {
    const countries = row['简单同族国家/地区'] || '';
    let score = 0;
    
    // 检查是否包含特定国家/地区并累加分数
    if (countries.includes('美国')) score += 5;
    if (countries.includes('欧洲')) score += 4;
    if (countries.includes('日本')) score += 4;
    if (countries.includes('韩国')) score += 3;
    
    // 确保最高分不超过10分
    return Math.min(score, 10);
}

// 计算经济寿命分数
function calculateEconomicLife(row) {
    // 获取申请日
    const applicationDate = row['申请日'] || '';
    
    // 如果申请日为空，返回0分
    if (!applicationDate) return 0;
    
    // 将申请日转换为Date对象
    const appDate = new Date(applicationDate);
    
    // 计算预估到期日（申请日+20年）
    const expiryDate = new Date(appDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 20);
    
    // 获取当前年份
    const currentYear = new Date().getFullYear();
    
    // 计算经济寿命分数
    const score = (expiryDate.getFullYear() - currentYear) * 0.5;
    
    // 确保分数在0到10分之间
    return Math.min(Math.max(score, 0), 10);
}

// 计算AT1分数 (10-(今天日期-申请日）/400)
function calculateAT1(row) {
    // 获取申请日
    const applicationDate = row['申请日'] || '';
    
    // 如果申请日为空，返回0分
    if (!applicationDate) return 0;
    
    // 将申请日转换为Date对象
    const appDate = new Date(applicationDate);
    const today = new Date();
    
    // 计算日期差（毫秒）
    const diffTime = Math.abs(today - appDate);
    // 转换为天数
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 计算AT1分数
    const score = 10 - (diffDays / 400);
    
    // 确保分数在0到10分之间
    return score;
}

// 计算AT2分数（国际国内领先性）
function calculateAT2(AC, AO) {
    // 处理特殊情况
    if (AC === 0 && AO === 0) return 2;  // 国内落后
    // if (AC === 0 && AO !== 0) return 0;  // 国际落后
    if (AC === 1 && AO === 0) return 10; // 国内空白

    // 处理一般情况
    if (AC >= 0.5) {
        if (AO >= 0.5) return 9;  // 国际领先
        if (AO > 0) return 8;     // 国内领先
        if (AO === 0) return 7;   // 国内先进
    } else {
        if (AO <= 0.5) return 6;  // 国际跟随
        if (AO === 0) return 5;   // 国内跟随
    }

    return 0; // 默认情况
}

/*
// 获取基础数据
async function fetchBaseData(query = '', countField = 'PTY', retryCount = 0) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "1dabba12828146fab6f79754b9b5b587");
    myHeaders.append("Content-Type", "application/json");

    var raw = JSON.stringify({
    "queryExpression": query,
    "field": countField,
    "mergeBy": "APE" //按申请号去重后保留公开最早文件
    });

    var requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow'
    };

    try {
        const response = await fetch("https://himmpat.com/api/service/himmuc_api/patent_search/get_filter_results_by_query_expression", requestOptions)

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 检查是否被限流
        if (data.code === 100) {
            // 更新loading提示为限流提示
            const loadingDiv = document.querySelector('.text-center.py-8');
            if (loadingDiv) {
                loadingDiv.innerHTML = `
                    <div class="text-yellow-600 mb-4">
                        <p class="font-semibold">请求被限流</p>
                        <p class="text-sm">系统正在等待30秒后重试...</p>
                    </div>
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-yellow-600 border-t-transparent"></div>
                `;
            }
            
            if (retryCount < 3) { // 最多重试3次
                console.log('请求被限流，等待30秒后重试...');
                await new Promise(resolve => setTimeout(resolve, 30000)); // 等待30秒
                return fetchBaseData(query, countField, retryCount + 1); // 递归重试
            } else {
                throw new Error('请求被限流，已达到最大重试次数');
            }
        }

        return data;
    } catch (error) {
        console.error('获取基础数据时出错:', error);
        throw error;
    }
}

// 获取所有基础数据
async function fetchAllBaseData(ipcQuery, applicantQuery) {
    let allData = {};
    const query0 = ipcQuery; //该ipc分类

    const query1 = 'CN/apc AND CN/ctry' + ' AND ' + query0; //受理局为中国 且 专利权人为中国
    const query2 = 'CN/apc' + ' AND ' + query0; //受理局为中国，受理局非中国的数量 直接用query0 - query2
    const query7 = 'CN/ctry' + ' AND ' + query0; //专利权人为中国，专利权人为中国且受理局非中国，直接用query7 - query1

    const query3 = 'N/state' + ' AND ' + query0; // 法律状态为无效，剩余都为有效
    
    const query4 = '2023/apd' + ' AND ' + query0; //申请日2023年
    const query5 = '2024/apd' + ' AND ' + query0; //申请日2024年

    const query6 = applicantQuery + ' AND ' + query3; //该专利申请人在该分类下的有效 

    const queryConf = [
        {
            query: query0,
            resKey: 'sum'
        },
        {
            query: query1,
            resKey: 'AC_1'
        },
        {
            query: query2,
            resKey: 'AC_2'
        },
        {
            query: query7,
            resKey: 'AC_3'
        },
        {
            query: query3,
            resKey: 'jishudulixing'
        },
        {
            query: query4,
            resKey: '2023sum'
        },
        {
            query: query5,
            resKey: '2024sum'
        },
        {
            query: query4,
            resKey: '2023personSum',
            countField: 'PAS'
        },
        {
            query: query5,
            resKey: '2024personSum',
            countField: 'PAS'
        },
        {
            query: query6,
            resKey: 'C2_1'
        }
    ];

        // CN/apc AND (A or U or B or D)/pty

    try {
        // 使用Promise.all并行处理所有查询
        const results = await Promise.all(
            queryConf.map(async ({ query, resKey, countField }) => {
                try {
                    const response = await fetchBaseData(query, countField);
                    //如果没有countField,把值汇总；有countField,返回key数量
                    const data = countField ? Object.keys(response.data).length : Object.values(response.data).reduce((pre, cur) => +pre + +cur, 0)
                    return { resKey, data };
                } catch (error) {
                    console.error(`获取${resKey}数据时出错:`, error);
                    return { resKey, data: null };
                }
            })
        );

        // 将结果存储到allData中
        results.forEach(({ resKey, data }) => {
            allData[resKey] = data;
        });

    } catch (error) {
        console.error('获取基础数据时出错:', error);
    }

    return allData;
}
*/

// 从JS文件获取基础数据
async function getBaseDataFromJson() {
    return ipcData;
}

// 计算技术成熟度得分
function calculateTechnicalMaturity(baseData) {
    // 计算2024年的值
    const value2024 = Math.sqrt(baseData['2024sum'] * baseData['2024personSum']);
    // 计算2023年的值
    const value2023 = Math.sqrt(baseData['2023sum'] * baseData['2023personSum']);
    // 计算差值
    const score = value2024 - value2023;
    
    // 根据得分范围设置不同的分数
    if (score > 5) {
        return 6;  // 大于5，得6分
    } else if (score >= 0) {
        return 8;  // 5到0，得8分
    } else if (score >= -5) {
        return 8;  // 0到-5，得8分
    } else {
        return 5.5;  // 小于-5，得5.5分
    }
}

// 计算专利价值度总分
function calculatePatentValue(technicalValue, legalValue, economicValue) {
    // 技术价值度部分 (46.64%)
    const technicalScore = (
        0.2343 * technicalValue.advancement +  // 技术先进性 23.43%
        0.1367 * technicalValue.dependency +   // 技术独立性 13.67%
        0.0954 * technicalValue.maturity       // 技术成熟度 9.54%
    );

    // 法律价值度部分 (36.23%)
    const legalScore = (
        0.1367 * legalValue.unavoidable +     // 不可规避性 13.67%
        0.1562 * legalValue.stability.total + // 专利实施风险 15.62%
        0.0694 * legalValue.multiCountry      // 多国申请情况 6.94%
    );

    // 经济价值度部分 (17.13%)
    const economicScore = (
        0.1041 * economicValue.life +         // 剩余经济寿命 10.41%
        0.0672 * economicValue.marketShare    // 市场占有率 6.72%
    );

    // 计算总分
    const totalScore = technicalScore + legalScore + economicScore;
    
    return totalScore;
}

// 修改processExcelData函数
async function processExcelData(jsonData) {
    try {
        // 获取基础数据
        const baseData = await getBaseDataFromJson();
        const dataset = require('./dataset');
        
        return await Promise.all(jsonData.map(async (row, index) => {
            const ipcCode = row['IPC主分类'];
            const applicant = row['第一专利权人'];
            
            // 获取该IPC分类号下的数据
            const ipcData = baseData[ipcCode];
            if (!ipcData) {
                // throw new Error(`未找到IPC分类号 ${ipcCode} 的数据`);
                return {
                    id: index + 1,
                    publicationNumber: row['公开（公告）号'],
                    title: row['标题-原文'],
                    errIpcCode: row['IPC主分类']
                };
            }

            // 从dataset中获取c2_1的值
            const c2_1 = dataset[ipcCode] && dataset[ipcCode][applicant] ? dataset[ipcCode][applicant].length : 0;
            // 计算技术先进性的子项
            const AT1Score = calculateAT1(row);
            const AC = ipcData.AC_1/ipcData.AC_2;
            const AO = (ipcData.AC_3 - ipcData.AC_1)/(ipcData.sum - ipcData.AC_2);
            const AT2Score = calculateAT2(AC, AO);
            
            // 计算技术先进性总分 (0.2AT1 + 0.8AT2)
            const technicalAdvancementScore = 0.2 * AT1Score + 0.8 * AT2Score;

            //技术独立性得分
            const technicalDependencyScore = (ipcData.sum - ipcData.jishudulixing)/ipcData.sum * 10;

            //技术成熟度得分 = 开根号(2024sum * 2024personSum) - 开根号(2023sum * 2023personSum)
            const technicalMaturityScore = calculateTechnicalMaturity(ipcData);

            // 计算专利稳定性的三个子项
            const B1_1 = calculateB1_1(row);
            const B1_2 = calculateB1_2(row);
            const B1_3 = calculateB1_3(row);

            // 计算专利稳定性总分
            const stabilityScore = 0.4 * B1_1 + 0.4 * B1_2 + 0.2 * B1_3;
            
            // 计算专利不可规避性
            const unavoidableScore = calculateUnavoidable(row);
            
            // 计算多国申请分数
            const multiCountryScore = calculateMultiCountry(row);
            
            // 计算经济寿命分数
            const economicLifeScore = calculateEconomicLife(row);

            //计算市场占有率
            const marketSharePercentage = (c2_1 / ipcData.jishudulixing) * 100;
            let marketShareScore;
            if (marketSharePercentage > 40) {
                marketShareScore = 10;
            } else if (marketSharePercentage >= 11) {
                marketShareScore = 8;
            } else if (marketSharePercentage >= 7) {
                marketShareScore = 6;
            } else if (marketSharePercentage >= 3) {
                marketShareScore = 4;
            } else if (marketSharePercentage > 0) {
                marketShareScore = 2;
            } else {
                marketShareScore = 0;
            }
            

            // 计算专利价值度总分
            const patentValue = calculatePatentValue(
                {
                    advancement: technicalAdvancementScore,
                    dependency: technicalDependencyScore,
                    maturity: technicalMaturityScore
                },
                {
                    unavoidable: unavoidableScore,
                    stability: { total: stabilityScore },
                    multiCountry: multiCountryScore
                },
                {
                    life: economicLifeScore,
                    marketShare: marketShareScore
                }
            );

        return {
            id: index + 1,
                publicationNumber: row['公开（公告）号'],
                title: row['标题-原文'],
            legalValue: {
                stability: {
                        total: parseFloat(stabilityScore.toFixed(2)),
                        B1_1: parseFloat(B1_1.toFixed(2)),
                        B1_2: parseFloat(B1_2.toFixed(2)),
                        B1_3: parseFloat(B1_3.toFixed(2))
                    },
                    unavoidable: parseFloat(unavoidableScore.toFixed(2)),
                    multiCountry: parseFloat(multiCountryScore.toFixed(2))
                },
                economicValue: {
                    life: parseFloat(economicLifeScore.toFixed(2)),
                    marketShare: marketShareScore
                },
                technicalValue: {
                    advancement: parseFloat(technicalAdvancementScore.toFixed(2)),
                    dependency: parseFloat(technicalDependencyScore.toFixed(2)),
                    maturity: parseFloat(technicalMaturityScore.toFixed(2))
                },
                patentValue: parseFloat(patentValue.toFixed(2))
        };
    }));
    } catch (error) {
        // 显示错误提示
        const analysisResults = document.getElementById('analysisResults');
        analysisResults.innerHTML = `
            <div class="text-center py-8">
                <div class="text-red-600 mb-4">
                    <p class="font-semibold">处理数据时出错</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </div>
                <p class="text-gray-600">请检查IPC数据文件是否完整，或联系管理员</p>
            </div>
        `;
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.querySelector('.upload-zone');
    const fileInput = document.getElementById('fileInput');
    const progressContainer = document.querySelector('.progress-bar').parentElement.parentElement;
    const analysisPanel = document.querySelector('.bg-white.rounded-lg.shadow-sm.p-8:last-child'); // 获取分析面板

    // 初始状态隐藏分析面板
    analysisPanel.style.display = 'none';

    // 点击上传区域触发文件选择
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // 处理文件上传
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 检查文件类型
        if (!file.name.match(/\.(xlsx|xls)$/)) {
            alert('请上传 Excel 文件！');
            return;
        }

        try {
            // 禁用文件上传
            fileInput.disabled = true;
            uploadZone.style.opacity = '0.5';
            uploadZone.style.cursor = 'not-allowed';
            
            // 清空之前的结果
            const analysisResults = document.getElementById('analysisResults');
            analysisResults.innerHTML = '';
            
            // 显示loading效果
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'text-center py-8';
            loadingDiv.innerHTML = `
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#0470bc] border-t-transparent"></div>
                <p class="mt-4 text-gray-600">正在计算中，请稍候...</p>
            `;
            analysisResults.appendChild(loadingDiv);
            
            // 更新上传区域显示选中的文件名
            const uploadText = uploadZone.querySelector('h3');
            const uploadDesc = uploadZone.querySelector('p');
            uploadText.textContent = file.name;
            
            // 显示进度条
            progressContainer.classList.remove('hidden');
            
            // 读取文件
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // 获取第一个工作表
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    
                    // 将工作表转换为JSON对象数组
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    // 检查数据条数
                    // if (jsonData.length > 4) {
                    //     alert('文件数据条数不能超过4条，请重新上传！');
                    //     // 恢复上传区域的默认显示
                    //     resetUploadZone();
                    //     // 隐藏分析面板
                    //     analysisPanel.style.display = 'none';
                    //     // 启用文件上传
                    //     fileInput.disabled = false;
                    //     uploadZone.style.opacity = '1';
                    //     uploadZone.style.cursor = 'pointer';
                    //     return;
                    // }
                    // 使用异步处理函数处理数据
                    const processedData = await processExcelData(jsonData);

                    // 更新文件描述，显示数据条数
                    uploadDesc.textContent = `共 ${processedData.length} 条数据`;

                    // 显示分析面板
                    analysisPanel.style.display = 'block';

                    // 添加1秒延迟后再更新分析面板
                    setTimeout(() => {
                    // 更新分析面板中的数据
                    updateAnalysisPanel(processedData);

                        // 启用文件上传
                        fileInput.disabled = false;
                        uploadZone.style.opacity = '1';
                        uploadZone.style.cursor = 'pointer';
                    }, 1000);

                } catch (error) {
                    console.error('解析Excel数据时出错:', error);
                    alert('解析文件时出错，请检查文件格式是否正确');
                    // 恢复上传区域的默认显示
                    resetUploadZone();
                    // 隐藏分析面板
                    analysisPanel.style.display = 'none';
                    // 启用文件上传
                    fileInput.disabled = false;
                    uploadZone.style.opacity = '1';
                    uploadZone.style.cursor = 'pointer';
                }
            };

            reader.onerror = (error) => {
                console.error('读取文件时出错:', error);
                alert('读取文件时出错');
                // 恢复上传区域的默认显示
                resetUploadZone();
                // 隐藏分析面板
                analysisPanel.style.display = 'none';
                // 启用文件上传
                fileInput.disabled = false;
                uploadZone.style.opacity = '1';
                uploadZone.style.cursor = 'pointer';
            };

            reader.readAsArrayBuffer(file);

        } catch (error) {
            console.error('处理Excel文件时出错:', error);
            alert('处理文件时出错，请检查文件格式是否正确');
            // 恢复上传区域的默认显示
            resetUploadZone();
            // 隐藏分析面板
            analysisPanel.style.display = 'none';
            // 启用文件上传
            fileInput.disabled = false;
            uploadZone.style.opacity = '1';
            uploadZone.style.cursor = 'pointer';
        }
    });

    // 处理拖放
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('border-primary');
    });

    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-primary');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('border-primary');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            // 触发 change 事件
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    });

    // 修改重置上传区域显示的函数
    function resetUploadZone() {
        const uploadText = uploadZone.querySelector('h3');
        const uploadDesc = uploadZone.querySelector('p');
        const uploadTip = uploadZone.querySelector('h4');
        uploadText.textContent = '点击或拖拽上传 Excel 文件';
        // uploadDesc.textContent = '数据条数需<=4，否则可能触发上游限流';
        uploadTip.textContent = '支持 .xlsx, .xls 格式文件';
        // 隐藏分析面板
        analysisPanel.style.display = 'none';
    }

    // 添加更新分析面板的函数
    function updateAnalysisPanel(data) {
        // 获取分析结果容器
        const analysisResults = document.getElementById('analysisResults');
        
        // 清空现有内容
        analysisResults.innerHTML = '';

        // 创建数据展示
        data.forEach(item => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'border border-gray-200 rounded-lg p-6';
            if(item.errIpcCode){
                resultDiv.innerHTML = `
                    <div class="mb-6">
                        <h3 class="text-xl font-bold text-gray-900">${item.publicationNumber}</h3>
                        <p class="text-gray-600 mt-1">${item.title}</p>
                    </div>
                    <h4 class="font-semibold text-lg text-gray-900">该IPC分类基础数据不存在，请检查IPC主分类号:${item.errIpcCode}</h4>
                `;
                analysisResults.appendChild(resultDiv);
                return ;
            }
            resultDiv.innerHTML = `
                <div class="mb-6">
                    <h3 class="text-xl font-bold text-gray-900">${item.publicationNumber}</h3>
                    <p class="text-gray-600 mt-1">${item.title}</p>
                </div>
                <div class="grid grid-cols-3 gap-6 mb-4">
                    <div class="bg-gray-50 rounded-lg p-6">
                    <div class="flex justify-between items-center">
                        <h4 class="font-semibold text-lg text-gray-900">技术价值度</h4>
                        <span class="text-2xl font-bold text-[#0470bc]">${(item.technicalValue.advancement * 0.2343 + item.technicalValue.dependency * 0.1367 + item.technicalValue.maturity * 0.0954).toFixed(2)}</span>
                    </div>
                    <div class="mt-4 space-y-2">
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">技术先进性</span>
                        <span class="font-medium text-gray-900">${item.technicalValue.advancement}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">技术独立性</span>
                        <span class="font-medium text-gray-900">${item.technicalValue.dependency}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">技术成熟度</span>
                        <span class="font-medium text-gray-900">${item.technicalValue.maturity}</span>
                        </div>
                    </div>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-6">
                    <div class="flex justify-between items-center">
                        <h4 class="font-semibold text-lg text-gray-900">法律价值度</h4>
                        <span class="text-2xl font-bold text-[#0470bc]">${(item.legalValue.unavoidable * 0.1367 + item.legalValue.stability.total * 0.1562 + item.legalValue.multiCountry * 0.0694).toFixed(2)}</span>
                    </div>
                    <div class="mt-4 space-y-2">
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">专利稳定性</span>
                        <span class="font-medium text-gray-900">${item.legalValue.stability.total}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">不可规避性</span>
                        <span class="font-medium text-gray-900">${item.legalValue.unavoidable}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">多国申请情况</span>
                        <span class="font-medium text-gray-900">${item.legalValue.multiCountry}</span>
                        </div>
                    </div>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-6">
                    <div class="flex justify-between items-center">
                        <h4 class="font-semibold text-lg text-gray-900">经济价值度</h4>
                        <span class="text-2xl font-bold text-[#0470bc]">${(item.economicValue.life * 0.1041 + item.economicValue.marketShare * 0.0672).toFixed(2)}</span>
                    </div>
                    <div class="mt-4 space-y-2">
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">剩余经济寿命</span>
                        <span class="font-medium text-gray-900">${item.economicValue.life}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">市场占有率</span>
                        <span class="font-medium text-gray-900">${item.economicValue.marketShare}</span>
                        </div>
                    </div>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-lg p-4 text-center">
                    <span class="text-lg text-gray-600 mr-4">专利价值度</span>
                    <span class="text-4xl font-bold text-[#0470bc]">${item.patentValue}</span>
                </div>
            `;
            analysisResults.appendChild(resultDiv);
        });
    }
});