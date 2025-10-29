const moment = require('moment');
const jobs = require('./jobs');

function indexJobsByInvoice(jobs) {
  const byInvoice = new Map();
  for (const j of jobs) {
    const k = j.invoice?.toString();
    if (!k) continue;
    if (!byInvoice.has(k)) byInvoice.set(k, []);
    byInvoice.get(k).push(j);
  }
  return byInvoice;
}

function attachJobsToOrdersWithAggregations(orders, byInvoice) {
  return orders.map(order => {
    const keys = [order.pedido_mm, order.pedido_wd]
      .map(v => v?.toString())
      .filter(Boolean);

    const seen = new Set();
    const relatedJobs = [];
    let maxDate = null;
    let statusSum = 0;
    const dateSet = new Set();
    const jobIdSet = new Set(); 

    for (const k of keys) {
      const arr = byInvoice.get(k);
      if (!arr) continue;

      for (const job of arr) {
        const id = job.id ?? job.invoice ?? job;
        if (seen.has(id)) continue;
        seen.add(id);
        relatedJobs.push(job);

        const d = moment(job.when_date);
        if (d.isValid()) {
          dateSet.add(d.format('YYYY-MM-DD'));
          if (!maxDate || d.isAfter(maxDate)) maxDate = d;
        }
        const s = Number(job.statusid);
        if (!isNaN(s)) statusSum += s;

        if (job.jobid) jobIdSet.add(job.jobid.toString());
      }
    }

    return {
      ...order,
      jobs: relatedJobs,
      max_when_date: maxDate ? maxDate: null,
      statusid: statusSum,
      when_date: Array.from(dateSet).sort().join('|') || null,
      jobsids: Array.from(jobIdSet).join('|') || null,
    };
  });
}

module.exports = {
    listOrders: async(month, year, orderIds) => {
        const dateFrom = new Date(year, month - 4, 1);
        const dateTo = new Date(year, month, 0);
        const ids = orderIds.join("', '");

        const db = require('./database');
        const sql = `
            select
                mp.pedido_mm,
                mp.pedido_wd,
                mp.data_criacao,
                CASE mp.status
                    WHEN 1 THEN 'NOVO'
                    WHEN 3 THEN 'NF PENDENTE'
                    WHEN 4 THEN 'CANCELADA'
                    WHEN 8 THEN 'NF OK'
                    ELSE '' 
                END mmstatus,
                concat('|',mc.documento) documento,
                mc.nome,
                mc.cep,
                mp.data_criacao,
                mc.uf,
                mc.cidade,
                mc.bairro
            from mm_pedido mp
            left join mm_comprador mc on mp.id_pedido = mc.id_pedido
            left join mm_items mi on mp.id_pedido = mi.id_pedido
                where (mp.data_criacao >= '${moment(dateFrom).format('YYYY-MM-DD')}'
                   and mp.data_criacao <= '${moment(dateTo).format('YYYY-MM-DD')}') 
                and mp.status in (3,8)
                and (mp.pedido_mm in ('${ids}') or mp.pedido_wd in ('${ids}'))
            group by 1
        `;

        const results = await db.query('plus', sql, [], 'Fetching orders from Iguanafix and MM');
        return results;
    },

    aggregateJobsDataToOrders: async(orders, jobs) => {
        const jobsByInvoice = indexJobsByInvoice(jobs);
        const ordersWithJobs = attachJobsToOrdersWithAggregations(orders, jobsByInvoice);

        return ordersWithJobs;
    },

    generateBillableOrders: async(orders) => {
        
        const billableOrders = orders.map(order => {
            const pedido_mm = order.pedido_mm || order.pedido_wd || '';
            const firstJob = order.jobs && order.jobs.length > 0 ? order.jobs[0] : null;
            // convert order.jobs.ifixamount to integer and sum
            const ifixamount = order.jobs ? order.jobs.reduce((sum, job) => {
                const val = parseFloat(job.ifixamount);
                if (!isNaN(val)) return sum + val;
                return sum;
            }, 0) : 0;
            
            const documento = (order.documento ? order.documento.split('|') : []).filter(d => d && d.trim().length > 0)[0] || '';

            return {
                serie_rps: '',
                serie_nfe: '',
                numero_rps: pedido_mm,
                data_rps: order.max_when_date.format('YYYY-MM-DD') || '',
                codigo_servico : '100503216',
                local_prestacao_servico : 2,
                servico_prestado_vias_publicas: 2,
                logradouro_local_servico: firstJob?.addressStreet || '',
                numero_local_servico: firstJob?.addressNumber || '',
                complemento_local_servico: '',
                bairro_local_servico: order.bairro || '',
                cidade_local_servico: order.cidade || '',
                uf_local_servico: order.uf || '',
                cep_local_servico: order.cep ? order.cep : '',
                quantidade_servico: 1,
                valor_servico: ifixamount.toString(),
                valor: ifixamount && ifixamount > 0 ? ifixamount / 100 : 0,
                valor_retencoes: 0,
                tomador_estrangeiro: 2,
                tomador_pais_nacionalidade: '001',
                servico_exportacao: 2,
                indicador_cpf_cnpj: 1, // 1=CPF, 2=CNPJ, atualmente só CPF
                cpf_cnpj_tomador: documento,
                nome_tomador: order.nome || '',
                logradouro_tomador: firstJob?.addressStreet || '',
                numero_tomador: firstJob?.addressNumber || '',
                complemento_tomador: '',
                bairro_tomador: order.bairro || '',
                cidade_tomador: order.cidade || '',
                uf_tomador: order.uf || '',
                cep_tomador: order.cep ? order.cep : '',
                email_tomador: firstJob?.email || '',
                discriminacao_servico: `Intermediação de serviços - Pedido ${pedido_mm}`,
                jobsids: order.jobsids || '',      
            };
        });

        return billableOrders;
    }
}