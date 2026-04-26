import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
    // 1. Create a transporter using the "Gmail" service
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // 2. Define the email options
    const mailOptions = {
        from: `Archive Identity <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
    };

    // 3. Actually send the email
    await transporter.sendMail(mailOptions);
};

export default sendEmail;
