const { Coupon, sequelize } = require('./models');

(async () => {
    try {
        const coupon = await Coupon.create({
            code: 'TEST2026',
            type: 'percentage',
            value: 15,
            minPurchase: 0,
            maxUses: null,
            expiresAt: null,
            organizationId: '11111111-1111-1111-1111-111111111111',
            createdBy: '11111111-1111-1111-1111-111111111111'
        });
        console.log('Coupon created:', coupon.id);
    } catch(e) {
        console.error('Error:', e);
    } finally {
        await sequelize.close();
    }
})();
