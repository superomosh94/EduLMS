// middleware/adminMiddleware.js
exports.setAdminLayoutData = (req, res, next) => {
    // Set default pageTitle if not already set
    if (!res.locals.pageTitle) {
        res.locals.pageTitle = 'Admin Dashboard';
    }
    
    // Set currentUser from session/passport
    if (req.user) {
        res.locals.currentUser = req.user;
    }
    
    // Set flash messages - handle both express-flash and connect-flash
    res.locals.messages = {
        success: req.flash('success') || [],
        error: req.flash('error') || [],
        warning: req.flash('warning') || [],
        info: req.flash('info') || []
    };
    
    // ONLY log when there are actual flash messages
    const hasFlashMessages = res.locals.messages.success.length > 0 || 
                            res.locals.messages.error.length > 0 || 
                            res.locals.messages.warning.length > 0 || 
                            res.locals.messages.info.length > 0;
    
    if (hasFlashMessages && process.env.NODE_ENV === 'development') {
        console.log('🔔 Flash messages found:', res.locals.messages);
    }
    
    next();
};