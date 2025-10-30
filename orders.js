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
            
            const documento = (order.documento ? order.documento.split('|') : []).filter(d => d && d.trim().length > 0)[0]?.trim().replace(/\D/g, '') || '';

            return {
              pedido_mm: pedido_mm.toString(),
              numero_rps: pedido_mm.toString().slice(-7),
              data_rps: order.max_when_date.format('YYYYMMDD') || '',
              end_servico_logradouro: firstJob?.addressStreet || '',
              end_servico_numero: firstJob?.addressNumber || '',
              end_servico_complemento: '',
              end_servico_bairro: order.bairro || '',
              end_servico_cidade: order.cidade || '',
              end_servico_uf: order.uf || '',
              end_servico_cep: order.cep ? order.cep : '',
              quantidade: 1,
              valor_servico_unitario: ifixamount || 0,
              valor_servico: ifixamount && ifixamount > 0 ? ifixamount / 100 : 0,
              ind_doc_tomador: documento.length === 11 ? 1 : 2,
              doc_tomador: documento,
              razao_tomador: order.nome || '',
              tomador_logradouro: firstJob?.addressStreet || '',
              tomador_numero: firstJob?.addressNumber || 'S/N',
              tomador_complemento: '',
              tomador_bairro: order.bairro || '',
              tomador_cidade: order.cidade || '',
              tomador_uf: order.uf || '',
              tomador_cep: order.cep ? order.cep : '',
              tomador_email: firstJob?.email || '',
              discriminacao: `Intermediação de serviços - Pedido ${pedido_mm}`,
              jobs_ids: order.jobsids || '', 
            };
        });

        const billable = billableOrders.filter(order => order.valor_servico_unitario && order.valor_servico_unitario > 0);
        const nonBillable = billableOrders.filter(order => !order.valor_servico_unitario || order.valor_servico_unitario === 0);

        return {
          billableOrders: billable,
          nonBillableOrders: nonBillable
        };
    }
}