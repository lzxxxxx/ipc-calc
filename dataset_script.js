const XLSX = require('xlsx');
const fs = require('fs');

// 读取Excel文件
function readExcelFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 将Excel数据转换为JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
}

// 处理数据并创建对象
function processData(data) {
    const result = {};
    
    // 遍历每一行数据
    data.forEach(row => {
        const ipc = row['IPC主分类'];
        const firstApplicant = row['[标]第一专利权人'];
        
        if (ipc && firstApplicant) {
            // 如果这个IPC分类号还没有在结果对象中，创建一个新对象
            const upperCaseIPC = ipc.toUpperCase();
            if (!result[upperCaseIPC]) {
                result[upperCaseIPC] = {};
            }
            
            // 如果这个专利权人还没有在IPC分类号下，创建一个新数组
            if (!result[upperCaseIPC][firstApplicant]) {
                result[upperCaseIPC][firstApplicant] = [];
            }
            
            // 将专利信息添加到对应专利权人的数组中
            result[upperCaseIPC][firstApplicant].push({
                ...row,
                // 移除已经用作键的字段，避免重复
                'IPC主分类': undefined,
                '[标]第一专利权人': undefined
            });
        }
    });
    
    return result;
}

// 主函数
function main() {
    try {
        // 读取Excel文件
        const data = readExcelFile('G21_data.xlsx');
        
        // 处理数据
        const processedData = processData(data);
        
        // 将处理后的数据写入JavaScript文件
        const output = `const dataset = ${JSON.stringify(processedData, null, 2)};\n\nmodule.exports = dataset;`;
        fs.writeFileSync('dataset.js', output);
        
        console.log('数据处理完成，已保存到 dataset.js');
    } catch (error) {
        console.error('处理数据时出错:', error);
    }
}

// 运行主函数
main(); 