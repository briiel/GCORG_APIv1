const adminModel = require('../models/adminModel');

const fetchAllAdmins = async () => {
    return await adminModel.getAllAdmins();
};

module.exports = { fetchAllAdmins };