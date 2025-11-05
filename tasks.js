const moment = require('moment');

module.exports = {
    getTasksFromDb: async(month, year) => {
        const dateFrom = new Date(year, month - 1, 1);
        const dateTo = new Date(year, month, 0);
        const db = require('./database');
        const sql = `
                      select 
                          tk.id as "pedido_mm", 
                          tk.id as "numero_rps", 
                          TO_CHAR(tq.charge_date, 'YYYYMMDD') as "data_rps", 
                          a.address as "end_servico_logradouro",
                          a."number" as "end_servico_numero",
                          a.address_details as "end_servico_complemento",
                          a.district as "end_servico_bairro",
                          c."name" as "end_servico_cidade",
                          s.initials as "end_servico_uf",
                          a.cep as "end_servico_cep",
                          1 as "quantidade",
                          cast(cast((tq.price * tq.tax * 100) as INTEGER) as text) as "valor_servico_unitario",
                          CAST((tq.price * tq.tax) as DECIMAL(10,2)) as "valor_servico",
                          1 as "ind_doc_tomador",
                          coalesce(cc.cpf, ua.cpf) as "doc_tomador",
                          ua."name"  as "razao_tomador",
                          a.address as "tomador_logradouro",
                          a."number" as "tomador_numero",
                          a.address_details as "tomador_complemento",
                          a.district as "tomador_bairro",
                          c."name" as "tomador_cidade",
                          s.initials as "tomador_uf",
                          a.cep as "tomador_cep",
                          coalesce(ua.email, ua.external_email, '') as tomador_email,
                          'Intermediação de serviços - Pedido ' || tk.id as discriminacao
                        from task tk
                          inner join user_account ua on ua.id = tk.user_id 
                          inner join task_quote tq on tq.task_id = tk.id and tq.selected = true and tq.is_charged = true
                          inner join customer_card cc on tk.customer_card_id = cc.id
                          inner join address a on tk.address_id = a.id
                          inner join city c on c.id = a.city_id 
                          inner join state s on s.id = c.state_id
                          where 
                                  tq.charge_date >= '${moment(dateFrom).format('YYYY-MM-DD')}' and 
                                  tq.charge_date <= '${moment(dateTo).format('YYYY-MM-DD')}' and 
                                  tq.is_paid = true
                        order by tq.charge_date;
        `;

        const results = await db.query('triider', sql, [], 'Fetching tasks from Triider');
        return results;
    }
}