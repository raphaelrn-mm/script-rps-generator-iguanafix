const mysql = require('mysql2/promise');
const { startLoading, stopLoading } = require('./loading');

module.exports = {
    query: async (db, sql, params = [], log_message = null) => {
        let connection = null;

        if (params === null) params = [];

        try{
            connection = await mysql.createConnection({
                host: process.env[`${db}_DB_HOST`],
                database: process.env[`${db}_DB_NAME`],
                user: process.env[`${db}_DB_USER`],
                password: process.env[`${db}_DB_PASS`],
                connectTimeout: process.env.DB_TIMEOUT_MINUTES ? parseInt(process.env.DB_TIMEOUT_MINUTES) * 60000 : 300000,
            });
        }catch(err){
            console.error('Error connecting to MySQL:', err);
            return null
        }

        // console.log('');
        // console.log(sql)
        // console.log('');

        try {
            startLoading(log_message === null ? 'Executing query:' : log_message);
            const [results] = await connection.execute(sql, params);
            stopLoading();
            return results;
        } catch (err) {
            console.log(err);
            return null;
        }
        finally {
            if (connection) {
                await connection.end();
            }
        }
    }
}