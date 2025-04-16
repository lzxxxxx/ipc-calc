const { contextBridge, ipcRenderer } = require('electron')
const XLSX = require('xlsx')

// 需要分析ipc分类号的字段：
// 受理局 没有  apc
// 专利权人 和申请人好像是一样的？ gras
// 法律状态 是否有效 是否有权？ state
// 专利申请人 paas
// 专利是否有效 没有
// 

// 计算 B1.1 分数
function calculateB1_1(row) {
    const citedPatents = parseFloat(row['引用专利数量'] || 0);
    const documentPages = parseFloat(row['文献页数'] || 1); // 避免除以0
    const score = (citedPatents / documentPages) * 5;
    return Math.min(score, 10); // 超过10分按10分算
}

// 计算 B1.2 分数
function calculateB1_2(row) {
    const independentClaim = row['独立权利要求'] || '';
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
    const claimCount = parseFloat(row['权利要求数'] || 0);
    return Math.min(claimCount, 10); // 最高10分
}

// 计算 B2.1 分数 (权利要求数量/文献页数)
function calculateB2_1(row) {
    const claimCount = parseFloat(row['权利要求数'] || 0);
    const documentPages = parseFloat(row['文献页数'] || 1); // 避免除以0
    return claimCount / documentPages;
}

// 计算 B2.2 分数 ((1 - 独立权利要求中"其特征"后面的字数/独立权利要求总字数)×10)
function calculateB2_2(row) {
    const independentClaim = row['独立权利要求'] || '';
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
    if (countries.includes('US')) score += 5;
    if (countries.includes('EP')) score += 4;
    if (countries.includes('JP')) score += 4;
    if (countries.includes('KR')) score += 3;
    
    // 确保最高分不超过10分
    return Math.min(score, 10);
}

// 计算经济寿命分数
function calculateEconomicLife(row) {
    // 获取预估到期日
    const expiryDate = row['预估到期日'] || '';
    
    // 如果预估到期日为空，返回0分
    if (!expiryDate) return 0;
    
    // 提取年份
    const expiryYear = parseInt(expiryDate.substring(0, 4));
    
    // 获取当前年份
    const currentYear = new Date().getFullYear();
    
    // 计算经济寿命分数
    const score = (expiryYear - currentYear) * 0.5;
    
    // 确保最高分不超过10分
    return Math.min(Math.max(score, 0), 10);
}

// 添加异步数据处理函数
async function processExcelData(jsonData) {
    return await Promise.all(jsonData.map(async (row, index) => {
        // 计算专利稳定性的三个子项
        const B1_1 = calculateB1_1(row);  // 引用专利数量/文献页数×5
        const B1_2 = calculateB1_2(row);  // 独立权利要求中"其特征在于"后面的字数/独立权利要求总字数×10
        const B1_3 = calculateB1_3(row);  // 权利要求数（最高10分）

        // 计算专利稳定性总分
        const stabilityScore = 0.4 * B1_1 + 0.4 * B1_2 + 0.2 * B1_3;
        
        // 计算专利不可规避性
        const unavoidableScore = calculateUnavoidable(row);
        
        // 计算多国申请分数
        const multiCountryScore = calculateMultiCountry(row);
        
        // 计算经济寿命分数
        const economicLifeScore = calculateEconomicLife(row);

        return {
            id: index + 1,
            publicationNumber: row['公开号'],
            title: row['标题'],
            legalValue: {
                stability: {
                    total: parseFloat(stabilityScore.toFixed(2)),  // 专利稳定性总分
                    B1_1: parseFloat(B1_1.toFixed(2)),            // B1.1 分数
                    B1_2: parseFloat(B1_2.toFixed(2)),            // B1.2 分数
                    B1_3: parseFloat(B1_3.toFixed(2))             // B1.3 分数
                },
                unavoidable: parseFloat(unavoidableScore.toFixed(2)),    // 不可规避性
                multiCountry: parseFloat(multiCountryScore.toFixed(2))    // 多国申请
            },
            economicValue: {
                life: parseFloat(economicLifeScore.toFixed(2)),    // 经济寿命
                marketShare: null    // 市场占有（待实现）
            },
            ...row
        };
    }));
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

                    // 使用异步处理函数处理数据
                    const processedData = await processExcelData(jsonData);

                    // 更新文件描述，显示数据条数
                    uploadDesc.textContent = `共 ${processedData.length} 条数据`;

                    // 显示分析面板
                    analysisPanel.style.display = 'block';

                    // 更新分析面板中的数据
                    updateAnalysisPanel(processedData);

                    // 打印处理后的数据
                    console.log('Excel数据:', processedData);
                } catch (error) {
                    console.error('解析Excel数据时出错:', error);
                    alert('解析文件时出错，请检查文件格式是否正确');
                    // 恢复上传区域的默认显示
                    resetUploadZone();
                    // 隐藏分析面板
                    analysisPanel.style.display = 'none';
                }
            };

            reader.onerror = (error) => {
                console.error('读取文件时出错:', error);
                alert('读取文件时出错');
                // 恢复上传区域的默认显示
                resetUploadZone();
                // 隐藏分析面板
                analysisPanel.style.display = 'none';
            };

            reader.readAsArrayBuffer(file);

        } catch (error) {
            console.error('处理Excel文件时出错:', error);
            alert('处理文件时出错，请检查文件格式是否正确');
            // 恢复上传区域的默认显示
            resetUploadZone();
            // 隐藏分析面板
            analysisPanel.style.display = 'none';
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
        uploadText.textContent = '点击或拖拽上传 Excel 文件';
        uploadDesc.textContent = '支持 .xlsx, .xls 格式文件';
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
            resultDiv.innerHTML = `
                <div class="mb-6">
                    <h3 class="text-xl font-bold text-gray-900">${item.publicationNumber}</h3>
                    <p class="text-gray-600 mt-1">${item.title}</p>
                </div>
                <div class="grid grid-cols-3 gap-6 mb-4">
                    <div class="bg-gray-50 rounded-lg p-6">
                    <div class="flex justify-between items-center">
                        <h4 class="font-semibold text-lg text-gray-900">技术价值度</h4>
                        <span class="text-2xl font-bold text-primary">--</span>
                    </div>
                    <div class="mt-4 space-y-2">
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">技术先进性</span>
                        <span class="font-medium text-gray-900">--</span>
                        </div>
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">技术独立性</span>
                        <span class="font-medium text-gray-900">--</span>
                        </div>
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">技术成熟度</span>
                        <span class="font-medium text-gray-900">--</span>
                        </div>
                    </div>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-6">
                    <div class="flex justify-between items-center">
                        <h4 class="font-semibold text-lg text-gray-900">法律价值度</h4>
                        <span class="text-2xl font-bold text-primary">--</span>
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
                        <span class="text-2xl font-bold text-primary">--</span>
                    </div>
                    <div class="mt-4 space-y-2">
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">剩余经济寿命</span>
                        <span class="font-medium text-gray-900">${item.economicValue.life}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                        <span class="text-gray-600">市场占有率</span>
                        <span class="font-medium text-gray-900">--</span>
                        </div>
                    </div>
                    </div>
                </div>
                <div class="bg-gray-50 rounded-lg p-4 text-center">
                    <span class="text-lg text-gray-600 mr-4">专利价值度</span>
                    <span class="text-4xl font-bold text-primary">--</span>
                </div>
            `;
            analysisResults.appendChild(resultDiv);
        });
    }
});