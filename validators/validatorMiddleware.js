const validate = (schema) => {
  return async (req, res, next) => {
    try {
      await schema.validateAsync(req.body, { abortEarly: false });
      next();
    } catch (error) {
      const errors = error.details.map((details) => details.message).join(", ");
      return res.status(400).json({
        status: 400,
        message: "Validation failed",
        error: errors,
      });
    }
  };
};

module.exports = { validate };
