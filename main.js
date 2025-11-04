require('dotenv').config();


const parseArgs = require('minimist');
const args = parseArgs(process.argv.slice(2));

const dataProviders = {
  iguanafix: require('./providers/iguanafix'),
  triider: require('./providers/triider'),
};

async function main(month, year, company) {
    console.log(`🚀 Iniciando geração de RPS para a empresa: ${company.toUpperCase()}`);
    console.log(`Período: ${month}/${year}`);
    console.log('--------------------------------------------------');
    const provider = dataProviders[company];
    if (!provider) {
        console.error(`❌ Erro: Empresa '${company}' não reconhecida.`);
        console.error(`Empresas disponíveis: ${Object.keys(dataProviders).join(', ')}`);
        process.exit(1);
    }

    const billableOrders = await provider.getOrders(month, year);

    if (!billableOrders || billableOrders.length === 0) {
        console.log('⚠️ Nenhum pedido faturável encontrado para o período. Encerrando.');
        process.exit(0);
    }

    console.log('--------------------------------------------------');
    console.log(`📦 Total de pedidos faturáveis a serem processados: ${billableOrders.length}`);
    console.log('Primeiros 5 pedidos para verificação:');
    console.log(billableOrders.slice(0, 5));
    console.log('--------------------------------------------------');

    // 2. Gerar os arquivos RPS.
    const rpsGenerator = require('./rps');
    const results = rpsGenerator.gerarArquivoRPS(billableOrders, month, year, company);

    if (results && results.length > 0) {
        console.log('✅ Geração de RPS concluída com sucesso!');
        results.forEach(result => {
            console.log(`   -> Arquivo gerado: ${result.outPath}`);
            console.log(`      - Total de RPS no arquivo: ${result.totalRPS}`);
            console.log(`      - Total de linhas no arquivo: ${result.totalLinhas}`);
        });
    } else {
        console.log('🟡 Nenhum arquivo RPS foi gerado.');
    }

    console.log('--------------------------------------------------');
    process.exit(0);
}

let month = args.month || null;
let year = args.year || null;
let company = (args.company || 'iguanafix').toLowerCase();

if (month !== null && year !== null) {
    if (typeof month === 'string') month = parseInt(month);
    if (typeof year === 'string') year = parseInt(year);

    if (isNaN(month) || month < 1 || month > 12) {
        console.log("Invalid month. Please provide a valid month (1-12).");
        process.exit(1);
    }

    if (isNaN(year) || year < 2025 || year > new Date().getFullYear()) {
        console.log("Invalid year. Please provide a valid year (from 2025 to current year).");
        process.exit(1);
    }

    main(month, year, company);
} else {
    console.log("Please provide --month and --year arguments.");
    process.exit(1);
}
