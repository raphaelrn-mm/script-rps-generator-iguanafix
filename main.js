require('dotenv').config();


const parseArgs = require('minimist');
const args = parseArgs(process.argv.slice(2));

async function main(month, year) {
    console.log(`🦎 Generating RPS for Iguanafix - Month: ${month}, Year: ${year}`);

    const jobsRepository = require('./jobs');
    let jobs = await jobsRepository.listJobs(month, year);

    let orderIds = jobs.map(job => job.invoice);
    orderIds = [...new Set(orderIds)];

    console.log(`${jobs.length} jobs found.`);
    console.log(`${orderIds.length} unique MM orders ids found on jobs.`);
    
    const ordersRepository = require('./orders');
    const orders = await ordersRepository.listOrders(month, year, orderIds);
    
    console.log(`${orders.length} orders found in MM data.`);

    const aggregatedJobs = await jobsRepository.aggregateOrdersDataToJobs(jobs, orders);
    // list only jobs with orders
    const jobsWithOrders = aggregatedJobs.filter(job => job.orders && job.orders.length > 0);
    console.log(`${jobsWithOrders.length} jobs have related MM orders.`);

    // list jobs with when_date in the target month
    const targetJobs = jobsWithOrders.filter(job => {
        const whenDate = new Date(job.when_date);
        return whenDate.getMonth() + 1 === month && whenDate.getFullYear() === year;
    });
    console.log(`${targetJobs.length} jobs have when_date in the target month.`);

    const aggregatedOrders = await ordersRepository.aggregateJobsDataToOrders(orders, jobs);
    const ordersWithJobs = aggregatedOrders.filter(order => order.jobs && order.jobs.length > 0);
    console.log(`${ordersWithJobs.length} jobs have related MM orders.`);

    const targetOrders = ordersWithJobs.filter(order => {
        const whenDate = new Date(order.max_when_date);
        return whenDate.getMonth() + 1 === month && whenDate.getFullYear() === year;
    });
    console.log(`${targetOrders.length} orders have max_when_date in the target month.`);

    const rpsData = await ordersRepository.generateBillableOrders(targetOrders);

    console.log('Generated RPS Data:');
    console.log(`Total billable orders: ${rpsData.billableOrders.length}`);
    console.log(`Total non-billable orders: ${rpsData.nonBillableOrders.length}`);

    console.log(rpsData.billableOrders.slice(0, 5)); // print only first 5 for brevity

    const rpsGenerator = require('./rps');
    const result = rpsGenerator.gerarArquivoRPS(rpsData.billableOrders, month, year);

    if (result) {
        console.log('RPS generation result:');
        console.log(result);
    } else {
        console.log('No RPS files generated.');
    }

    console.log('🦎 RPS generation completed.');

    process.exit(0);
}

let month = args.month || null;
let year = args.year || null;

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

    main(month, year);
} else {
    console.log("Please provide --month and --year arguments.");
    process.exit(1);
}