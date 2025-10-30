const fs = require('fs');

const CRLF = '\r\n';

// Posições conforme PDF oficial https://www.barueri.sp.gov.br/nfe/Manuais/RPS_Layout.pdf
const LAYOUT = {
  // Tipo 1 – Cabeçalho
  t1: {
    tamanho: 26, // até o CRLF (posição final 26)
    campos: [
      ['fixo_num', 1,  1,  1,  '1'],                         // Tipo do Registro
      ['texto',    7,  2,  8,  'inscricao_contribuinte'],    // Inscrição do Prestador
      ['fixo_txt', 6,  9,  14, 'PMB002'],                   // Versão do Layout (ex.: "PMB002")
      ['num',      11, 15, 25, 'identificacao_remessa'],    // ID exclusivo da remessa
      // 26: CRLF
    ]
  },

  // Tipo 2 – Detalhe
  t2: {
    tamanho: 1971,
    campos: [
      ['fixo_num',   1,    1,    1,    '2'],                        // Tipo do Registro
      ['fixo_txt',   5,    2,    6,    'RPS'],                      // "RPS"
      ['fixo_txt',   4,    7,    10,   ''],                         // Série do RPS
      ['fixo_txt',   5,    11,   15,   ''],                         // Série NF-e (regime especial)
      ['num',        10,   16,   25,   'numero_rps'],               // Número do RPS (3 primeiros dígitos reservados)
      ['data',       8,    26,   33,   'data_rps'],                 // AAAAMMDD
      ['fixo_hora',  6,    34,   39,   '000000'],                   // HHMMSS
      ['fixo_txt',   1,    40,   40,   'E'],                        // "E" para RPS Enviado / "C" para RPS Cancelado
      ['fixo_txt',   2,    41,   42,   null],                       // se C
      ['fixo_txt',   7,    43,   49,   null],                       // se C
      ['fixo_txt',   5,    50,   54,   null],                       // se C + regime esp.
      ['fixo_txt',   8,    55,   62,   null],                       // se C
      ['fixo_txt',   180,  63,   242,  null],                       // se C
      ['fixo_num',   9,    243,  251,  '100503216'],                // Código da atividade
      ['fixo_txt',   1,    252,  252,  '2'],                        // 1=município / 2=fora (exceções)
      ['fixo_txt',   1,    253,  253,  '2'],                        // 1=em vias públicas / 2=não (exceções)
      ['texto',      75,   254,  328,  'end_servico_logradouro'],
      ['texto',      9,    329,  337,  'end_servico_numero'],
      ['texto',      30,   338,  367,  'end_servico_complemento'],
      ['texto',      40,   368,  407,  'end_servico_bairro'],
      ['texto',      40,   408,  447,  'end_servico_cidade'],
      ['texto',      2,    448,  449,  'end_servico_uf'],
      ['texto',      8,    450,  457,  'end_servico_cep'],
      ['num',        6,    458,  463,  'quantidade'],               // inteiro
      ['money',      15,   464,  478,  'valor_servico_unitario'],   // valor unitário (centavos)
      ['texto',      5,    479,  483,  null],                       // Reservado (branco)
      ['fixo_money', 15,   484,  498,  '0'],                        // valor total das retenções
      ['fixo_num',   1,    499,  499,  '2'],                        // 1=estrangeiro 2=brasileiro
      ['fixo_num',   3,    500,  502,  '1'],                        // se estrangeiro
      ['fixo_num',   1,    503,  503,  '2'],                        // 1 exportado / 2 não
      ['texto',      1,    504,  504,  'ind_doc_tomador'],          // 1 CPF / 2 CNPJ (se não estrangeiro)
      ['num',        14,   505,  518,  'doc_tomador'],              // se não estrangeiro
      ['texto',      60,   519,  578,  'razao_tomador'],
      ['texto',      75,   579,  653,  'tomador_logradouro'],       // se não estrangeiro
      ['texto',      9,    654,  662,  'tomador_numero'],           // se não estrangeiro
      ['texto',      30,   663,  692,  'tomador_complemento'],      // se não estrangeiro
      ['texto',      40,   693,  732,  'tomador_bairro'],           // se não estrangeiro
      ['texto',      40,   733,  772,  'tomador_cidade'],           // se não estrangeiro
      ['texto',      2,    773,  774,  'tomador_uf'],               // se não estrangeiro
      ['texto',      8,    775,  782,  'tomador_cep'],              // se não estrangeiro
      ['texto',      152,  783,  934,  'tomador_email'],            // até 3 usando "|", obrigatório PJ
      ['fixo_num',   6,    935,  940,  null],
      ['fixo_money', 15,   941,  955,  null],                       // se fatura_numero
      ['fixo_txt',   15,   956,  970,  null],                       // se fatura_numero
      ['texto',      1000, 971,  1970, 'discriminacao'],            // com '|' a cada 100 chars
      // 1971: CRLF
    ]
  },

  // Tipo 9 – Rodapé
  t9: {
    tamanho: 39,
    campos: [
      ['fixo_num',   1,  1,  1,  '9'],
      ['num',        7,  2,  8,  'qtde_linhas'],           // total de registros 1,2,3,9
      ['money',      15, 9,  23, 'total_servicos'],        // soma de (quantidade * valor_unit)
      ['fixo_money', 15, 24, 38, '0000'],                  // soma de valores em tipo 3
      // 39: CRLF
    ]
  }
};

// ===== Helpers de formatação =====
const padRight = (str, length) => (str ?? '').toString().slice(0, length).padEnd(length, ' ');
const padLeft = (str, length) => (str ?? '').toString().replace(/\D/g, '').slice(-length).padStart(length, ' ');
const padLeftZeros = (str, length) => (str ?? '').toString().replace(/\D/g, '').slice(-length).padStart(length, !str? ' ' : '0');

const onlyDigits = (v='') => (v ?? '').toString().replace(/\D/g,'');

const moneyToFixed = (v, length=15) => {
  if (v === null || v === undefined || v === '') return ''.padStart(length,'0');
  
  let s = (v+'').trim().replace(/\./g,'').replace(',', '.');
  const n = Number(s);

  if (Number.isNaN(n)) return ''.padStart(length,'0');

  const cents = Math.round(n * 100);
  return String(cents).padStart(length, '0').slice(-length);
};

function buildLine(campos, data) {

  // Para garantir posições, criamos um buffer do tamanho do registro:
  const tamanho = campos[campos.length-1][3]; // posição final do último campo

  let buf = Array(tamanho).fill(' ');
  for (const [tipo, tam, ini, fim, key] of campos) {
    let val = '';
    if (key && key in data) {
      val = data[key];
    }

    switch (tipo) {
      case 'fixo_num':
      case 'fixo_money':
        val = padLeftZeros(key, tam); break;
      case 'fixo_txt':
      case 'fixo_hora':
        val = padRight(key, tam); break;
      case 'num':
      case 'money':
        val = padLeftZeros(val ?? 0, tam); break;
      case 'texto':
      case 'data':
      case 'hora':
      case 'money':
      default:
        val = padRight((val ?? '').toString(), tam); break;
    }

    // Escreve no buffer (posições 1-based no layout):
    const start = ini - 1, end = fim; // fim é inclusivo
    for (let i = 0; i < tam; i++) {
      buf[start + i] = (val[i] ?? ' ');
    }
  }
  return buf.join('');
}

function generateRemessaId(sequence = 1, month, year) {
  const dateFile = new Date(year, month, 0);
  const date = dateFile.toISOString().slice(0,10).replace(/-/g, ''); // YYYYMMDD
  const seq = String(sequence).padStart(3, '0');
  return `${date}${seq}`;
}

function gerarArquivoRPSChunk(orders, sequence, month, year) {
  const inscricaoContribuinte = '4BD0910';
  const identificacaoRemessa = generateRemessaId(sequence, month, year);

  // Cabeçalho (tipo 1)
  const t1_row = {
    inscricao_contribuinte: onlyDigits(inscricaoContribuinte).padStart(7,'0').slice(-7),
    identificacao_remessa: onlyDigits(identificacaoRemessa).padStart(11,'0').slice(-11),
  };
  const t1 = buildLine(LAYOUT.t1.campos, t1_row) + CRLF;

  let linhas = [t1];
  let totalServicos = 0n;
  let totalLinhas = 1; // já contou o tipo 1

  for (const order of orders) {
    totalServicos += BigInt(order.valor_servico);

    const t2 = buildLine(LAYOUT.t2.campos, order) + CRLF;
    linhas.push(t2); totalLinhas++;
  }

  totalServicos = totalServicos*100n; // converter para centavos

  // Rodapé (tipo 9)
  const t9 = buildLine(LAYOUT.t9.campos, {
    qtde_linhas: String(totalLinhas + 1), // +1 do próprio tipo 9
    total_servicos: totalServicos.toString(),
  }) + CRLF;

  linhas.push(t9);

  const dir = `${__dirname}/generated`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const outPath = `${dir}/${identificacaoRemessa}.txt`;
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  fs.writeFileSync(outPath, linhas.join(''), { encoding: 'utf8' });

  return { outPath, totalRPS: orders.length, totalLinhas: totalLinhas + 1, totalServicos: totalServicos.toString() };
}

module.exports = {
  gerarArquivoRPS: (orders, month, year) => {
    if (orders.length === 0) {
      console.log('Nenhum RPS para gerar.');
      return null;
    }

    //quebrar os registros em multiplos arquivos de 1000 rps
    const chunkSize = 1000;
    const chunks = [];
    for (let i = 0; i < orders.length; i += chunkSize) {
      chunks.push(orders.slice(i, i + chunkSize));
    }

    const results = [];
    chunks.forEach((chunk, index) => {
      const result = gerarArquivoRPSChunk(chunk, index + 1, month, year);
      results.push(result);
    });

    return results;
  }
}
