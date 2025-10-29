const moment = require('moment');
const { startLoading, stopLoading } = require('./loading');

function indexOrders(orders) {
  const byInvoice = new Map();
  for (const o of orders) {
    const keys = [o.pedido_mm, o.pedido_wd]
      .map(v => v?.toString())
      .filter(Boolean);
    for (const k of keys) {
      if (!byInvoice.has(k)) byInvoice.set(k, []);
      byInvoice.get(k).push(o);
    }
  }
  return byInvoice;
}

module.exports = {
    listJobs: async(month, year) => {
        const dateFrom = new Date(year, month - 4, 1);
        const dateTo = new Date(year, month, 0);

        const db = require('./database');
        // const sql = `
        //     select
        //         j.id,
        //         s.reseller_invoice,
        //         trim(replace(replace(replace(replace(s.reseller_invoice,'GUIDESHOPMM: ',''),'TDVMM: ',''),'MM: ',''),'CasaTema: ','')) invoice,
        //         j.id jobid,
        //         j.status jobstatus,
        //         j.created_on,
        //         j.when_date,
        //         s.extra_4 sku,
        //         ss.item_id,
        //         j.category_id 
        //     from iguanafix.job j
        //     join iguanafix.str_order_detail ss on ss.extra_ref = j.id and ss.item_type = 'JOB_INSTALLATION'
        //     join iguanafix.str_order s on ss.order_id = s.id
        //         where (j.created_on  >= '${moment(dateFrom).format('YYYY-MM-DD')}'
        //         and j.created_on <= '${moment(dateTo).format('YYYY-MM-DD')}')
        //         and j.reseller_id in (349,351,353,352)
        //         and j.status in (4,5)
        //         and s.reseller_invoice is not NULL
        //     order by j.created_on desc
        // `;

        const sql = `
          select
            j.id,
            s.reseller_invoice,
            trim(replace(replace(replace(replace(s.reseller_invoice,'GUIDESHOPMM: ',''),'TDVMM: ',''),'MM: ',''),'CasaTema: ','')) invoice,
            j.id jobid,
            j.status jobstatus,
            j.created_on,
            j.when_date,
            s.extra_4 sku,
            j.category_id,
            j.city,
            (case MID(j.city,4,2) when 'PA' then 'PR' when 'PR' then 'PA' else MID(j.city,4,2) end) uf,
            (select city.name 
              from city 
              where city.parent_code = MID(j.city,4,2) 
              and city.code = MID(j.city,7,2)
              limit 1) as city_name,
            (select neighborhood.name 
              from neighborhood 
              where neighborhood.parent_code = MID(j.city,7,2) 
              and neighborhood.code = MID(j.city,10,2) 
              limit 1) as neighborhood_name,
            (select sa.address
              from str_order_address sa
              where sa.order_id = ss_ref.order_id limit 1) addressStreetFull,
            (select case when LENGTH(substring(sa.address, 1, locate(',', sa.address) - 1)) < 1
                then sa.address 
                else substring(sa.address, 1, locate(',', sa.address) - 1) end
              from str_order_address sa
              where sa.order_id = ss_ref.order_id limit 1) addressStreet,
            (select trim(substring(sa.address, locate(',', sa.address) + 1, 999))
              from str_order_address sa
              where sa.order_id = ss_ref.order_id limit 1) addressNumber,
            (select cust.email 
              from customer cust
              where cust.id = j.owner_id limit 1) as email,
            (select sum(CASE
                  WHEN ss.price = 11000 THEN 4000
                  WHEN ss.price = 11900 THEN 4400
                  WHEN ss.price = 12900 THEN 4800
                  WHEN ss.price = 14500 THEN 5500
                  WHEN ss.price = 15900 THEN 6000
                  WHEN ss.price = 17500 THEN 6500
                  WHEN ss.price = 18400 THEN 7100
                  WHEN ss.price = 19500 THEN 7800
                  WHEN ss.price = 20400 THEN 8200
                  WHEN ss.price = 21500 THEN 8600
                  WHEN ss.price = 22900 THEN 9200
                  WHEN ss.price = 24400 THEN 9800
                  WHEN ss.price = 26000 THEN 10500
                  WHEN ss.price = 27400 THEN 11100
                  WHEN ss.price = 29400 THEN 11900
                  WHEN ss.price = 31000 THEN 13000
                  WHEN ss.price = 35900 THEN 15100
                  WHEN ss.price = 40900 THEN 17200
                  WHEN ss.price = 45900 THEN 19300
                  WHEN ss.price = 50900 THEN 21400
                  WHEN ss.price = 55900 THEN 23500
                  WHEN ss.price = 59900 THEN 26900
                  WHEN ss.price = 64900 THEN 29200
                  WHEN ss.price = 69900 THEN 31400
                  WHEN ss.price = 74900 THEN 33700
                  WHEN ss.price = 79900 THEN 35900
                  WHEN ss.price = 84900 THEN 38200
                  WHEN ss.price = 89900 THEN 40400
                  WHEN ss.price = 94900 THEN 42700
                  WHEN ss.price = 99900 THEN 44900
                  WHEN ss.price = 104900 THEN 47200
                  WHEN ss.price = 109900 THEN 49500
                  WHEN ss.price = 114900 THEN 51700
                  WHEN ss.price = 119900 THEN 54000
                  WHEN ss.price = 124900 THEN 56200
                  WHEN ss.price = 129900 THEN 58500
                  WHEN ss.price = 134900 THEN 60700
                  WHEN ss.price = 139900 THEN 63000
                  WHEN ss.price = 144900 THEN 65200
                  WHEN ss.price = 149900 THEN 67500
                  WHEN ss.price = 154900 THEN 69700
                  WHEN ss.price = 159900 THEN 72000
                  WHEN ss.price = 164900 THEN 74200
                  WHEN ss.price = 169900 THEN 76500
                  WHEN ss.price = 174900 THEN 78700
                  WHEN ss.price = 179900 THEN 81000
                  WHEN ss.price = 184900 THEN 83200
                  WHEN ss.price = 189900 THEN 85500
                  WHEN ss.price = 194900 THEN 87700
                  WHEN ss.price = 199900 THEN 90000
                  ELSE 0 END * ss.quantity)
              from str_order_detail ss
              where ss.extra_ref = j.id and ss.item_type = 'JOB_INSTALLATION') ifixamount
          from iguanafix.job j
          join iguanafix.str_order_detail ss_ref on ss_ref.extra_ref = j.id and ss_ref.item_type = 'JOB_INSTALLATION'
          join iguanafix.str_order s on ss_ref.order_id = s.id
              where (j.created_on  >= '${moment(dateFrom).format('YYYY-MM-DD')}'
              and j.created_on <= '${moment(dateTo).format('YYYY-MM-DD')}')
              and j.reseller_id in (349,351,353,352)
              and j.status in (4,5)
              and s.reseller_invoice is not NULL
          order by j.created_on desc
        `;

        const results = await db.query('ifix', sql, [], 'Fetching jobs from Iguanafix');
        return results;
    },

    aggregateOrdersDataToJobs: async(jobs, orders) => {
        startLoading('Aggregating orders data to jobs');

        const ordersByInvoice = indexOrders(orders);
        const jobsWithOrders = jobs.map(job => {
            const key = job.invoice?.toString();
            return {
                ...job,
                orders: key ? (ordersByInvoice.get(key) || []) : []
            };
        });
        stopLoading();

        return jobsWithOrders;
    }
}