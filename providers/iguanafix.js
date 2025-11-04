async function getOrders(month, year) {
  console.log(`🦎 Generating RPS for Iguanafix - Month: ${month}, Year: ${year}`);

    const jobsRepository = require('../jobs');
    let jobs = await jobsRepository.listJobs(month, year);

    let orderIds = jobs.map(job => job.invoice);
    orderIds = [...new Set(orderIds)];

    console.log(`${jobs.length} jobs found.`);
    console.log(`${orderIds.length} unique MM orders ids found on jobs.`);
    
    const ordersRepository = require('../orders');
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

    console.log(rpsData.billableOrders.slice(0, 5));
    return rpsData.billableOrders;
}

module.exports = {
  getOrders,
};