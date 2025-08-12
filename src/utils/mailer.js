const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gc.ccs.organize@gmail.com',
    pass: 'lhex wnkz qahe bmox',
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