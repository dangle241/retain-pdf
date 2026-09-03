Token is the basic unit used by the model to represent natural language text, also our billing unit, intuitively understood as "character" or "word"; usually 1 English word missing, 1 number, or 1 symbol counted as 1 token.

Model contains fields. Remove unused ones. token Approximate conversion ratio to word count:

1 English character ≈ 0.3 token.
1 non-ASCII character ≈ 0.6 token.
However, tokenization differs across models, so conversion ratios vary; each actual processing ... token Quantity is based on the model's return; you can from the returned results usage Check in Chinese.