const xlsx = require("xlsx");

/**
 * 处理 Excel 文件流并返回 JSON 结果
 * @param {Buffer} fileBuffer - Excel 文件的 Buffer 流
 * @returns {Object} 计算后的 JSON 数据
 */
function processExcelFile(fileBuffer) {
  // 解析 Excel 文件
  const workbook = xlsx.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0]; // 读取第一个 sheet
  const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // 需要保留的列
  const selectedColumns = [
    "公开（公告）号",
    "IPC主分类",
    "全球专利类型分类",
    "[标]第一申请人",
    "申请日",
    "他引次数",
    "简单同族申请数量",
    "受理局",
    "说明书页数",
    "权利要求数量",
  ];

  // 数据清洗
  let cleanedData = rawData.map((entry) => {
    return selectedColumns.reduce((obj, key) => {
      obj[key] = entry[key] !== undefined && entry[key] !== null ? entry[key] : 8; // 填充所有空值为 8
      return obj;
    }, {});
  });

  // 过滤掉空值列
  cleanedData = cleanedData.filter((entry) =>
    ["IPC主分类", "全球专利类型分类", "[标]第一申请人", "申请日", "受理局", "简单同族申请数量"].every(
      (key) => entry[key] !== null
    )
  );

  // 类型转换
  cleanedData = cleanedData.map((entry) => ({
    ...entry,
    "IPC主分类": entry["IPC主分类"].toUpperCase(),
    "申请日": new Date(entry["申请日"]),
    "是否发明专利": entry["全球专利类型分类"] === "发明申请",
    "是否近五年": new Date(entry["申请日"]).getFullYear() >= new Date().getFullYear() - 5,
    "是否国外专利": entry["受理局"].toUpperCase() !== "中国",
  }));

  // 分组计算 IPC 统计数据
  const groupedData = {};
  cleanedData.forEach((entry) => {
    const ipc = entry["IPC主分类"];
    if (!groupedData[ipc]) {
      groupedData[ipc] = {
        总专利数: 0,
        发明专利占比: 0,
        他引次数平均值: 0,
        同族专利平均值: 0,
        说明页数平均值: 0,
        权利要求平均值: 0,
        国外专利占比: 0,
        近五年专利占比: 0,
        申请人计数: {},
      };
    }

    const group = groupedData[ipc];
    group.总专利数++;
    group.发明专利占比 += entry["是否发明专利"] ? 1 : 0;
    group.他引次数平均值 += entry["他引次数"];
    group.同族专利平均值 += entry["简单同族申请数量"];
    group.说明页数平均值 += entry["说明书页数"];
    group.权利要求平均值 += entry["权利要求数量"];
    group.国外专利占比 += entry["是否国外专利"] ? 1 : 0;
    group.近五年专利占比 += entry["是否近五年"] ? 1 : 0;

    // 统计申请人
    const applicant = entry["[标]第一申请人"];
    group.申请人计数[applicant] = (group.申请人计数[applicant] || 0) + 1;
  });

  // 计算最终统计数据
  Object.keys(groupedData).forEach((ipc) => {
    const group = groupedData[ipc];
    group.发明专利占比 /= group.总专利数;
    group.他引次数平均值 /= group.总专利数;
    group.同族专利平均值 /= group.总专利数;
    group.说明页数平均值 /= group.总专利数;
    group.权利要求平均值 /= group.总专利数;
    group.国外专利占比 /= group.总专利数;
    group.近五年专利占比 /= group.总专利数;

    // 计算前十申请人占比
    const sortedApplicants = Object.values(group.申请人计数).sort((a, b) => b - a);
    group.前十申请人占比 = sortedApplicants.slice(0, 10).reduce((sum, count) => sum + count, 0) / group.总专利数;
  });

  // 计算得分
  Object.keys(groupedData).forEach((ipc) => {
    const group = groupedData[ipc];

    const A1 = group.发明专利占比;
    const A2 = group.前十申请人占比;
    const A3 = group.近五年专利占比;
    const A4 = group.他引次数平均值 > 8 ? 1 : 0.5;
    const A5 = group.同族专利平均值 > 5 ? 1 : group.同族专利平均值 > 1 ? 0.5 : 0;
    const A6 = group.国外专利占比;
    const A7 = group.说明页数平均值 > 8 ? 1 : 0.5;
    const A8 = group.权利要求平均值 > 8 ? 1 : 0.5;

    group.前沿得分 = (0.3 * Number(A1) + 0.18 * Number(A2) + 0.12 * Number(A3) + 0.2 * Number(A4) + 0.08 * Number(A5) + 0.1 * Number(A6) + 0.01 * (Number(A7) + Number(A8))).toFixed(3);
    group.热点得分 = (0.2 * (A1 + A3 + A4) + 0.15 * A2 + 0.1 * A5 + 0.12 * A6 + 0.01 * A7 + 0.02 * A8).toFixed(3);
    group.关键得分 = (0.25 * A1 + 0.2 * (A2 + A4) + 0.1 * (A3 + A5) + 0.12 * A6 + 0.01 * A7 + 0.02 * A8).toFixed(3);
    group.顶层得分 = (0.2 * A1 + 0.18 * A2 + 0.1 * A3 + 0.22 * A4 + 0.1 * A5 + 0.16 * A6 + 0.02 * A7 + 0.02 * A8).toFixed(3);
  });

  // 生成排名
  const rankings = {
    前沿技术: Object.keys(groupedData).map(ipc => ({
      IPC主分类: ipc,
      得分: groupedData[ipc].前沿得分
    })).sort((a, b) => b.得分 - a.得分).slice(0, 10), // 取前十名

    热点技术: Object.keys(groupedData).map(ipc => ({
      IPC主分类: ipc,
      得分: groupedData[ipc].热点得分
    })).sort((a, b) => b.得分 - a.得分).slice(0, 10), // 取前十名

    关键技术: Object.keys(groupedData).map(ipc => ({
      IPC主分类: ipc,
      得分: groupedData[ipc].关键得分
    })).sort((a, b) => b.得分 - a.得分).slice(0, 10), // 取前十名

    顶层技术: Object.keys(groupedData).map(ipc => ({
      IPC主分类: ipc,
      得分: groupedData[ipc].顶层得分
    })).sort((a, b) => b.得分 - a.得分).slice(0, 10) // 取前十名
  };

  return rankings;
}

module.exports = { processExcelFile };
