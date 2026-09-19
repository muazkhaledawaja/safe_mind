// validate({ body, query, params }) parses each given zod schema against the
// matching req.* and replaces it with the parsed (typed, defaulted) value.
// Throws ZodError on failure — caught by errorHandler.
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
