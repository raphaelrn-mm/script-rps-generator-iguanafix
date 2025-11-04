const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

async function getOrders(month, year) {
  console.log(`⚙️  Generating RPS for Triider - Month: ${month}, Year: ${year}`);

  const csvFileName = `triider-${month}-${year}.csv`;
  const csvFilePath = path.join(__dirname, '../', 'data/', csvFileName);

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ Erro: Arquivo de dados da Triider não encontrado em: ${csvFilePath}`);
    process.exit(1);
  }

  console.log(`📄 Lendo dados de: ${csvFilePath}`);
  const fileContent = fs.readFileSync(csvFilePath);
/*  
  quando tiver o banco
  const tasksRepository = require('../tasks');
  const tasks = await tasksRepository.getTasksFromDb(month, year);
  console.log(`✅ Dados lidos com sucesso. Total de registros: ${tasks.length}`);
*/

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let triiderBillableOrders = records.map(record => {
    const valorServicoEmReais = Number.parseFloat(record.valor_servico) || 0;
    const valorUnitarioEmCentavos = Number.parseInt(record.valor_servico_unitario, 10) || 0;

    return {
      ...record,
      id_pedido: record.pedido_mm,
      data_competencia: record.data_rps,
      valor_servico: valorServicoEmReais,
      valor_servico_unitario: valorUnitarioEmCentavos,

    };
  });

  return triiderBillableOrders;
}

module.exports = {
  getOrders,
};