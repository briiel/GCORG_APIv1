const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ccs.gcorganize@gmail.com',
    pass: 'dpno augb lvim sdqe', // Use an app password, not your main Gmail password
  },
});

function sendRegistrationEmail(to, subject, text) {
  const mailOptions = {
    from: 'ccs.gcorganize@gmail.com',
    to,
    subject,
    text,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendRegistrationEmail };