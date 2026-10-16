# {{Thing being described: command, config file, API module}}

<!-- REFERENCE = neutral, complete, accurate description for lookup. Mirror the
     structure of the thing itself. No opinions, no tutorials, no narrative.
     Generate from source (--help output, schema, docstrings) where possible. -->

{{One sentence: what this is and where it applies.}} Applies to version {{VERSION}}.

## Synopsis

```bash
{{tool command [OPTIONS] ARGUMENT}}
```

## Arguments

| Argument | Required | Description |
|---|---|---|
| `{{name}}` | yes | {{what it is}} |

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `--{{flag}}` | `{{type}}` | `{{default}}` | {{what it does}} |

## Examples

```bash
{{tool command with realistic values}}
```

```text
{{output}}
```

## Exit codes and errors

| Code / message | Meaning |
|---|---|
| `0` | Success |
| `{{1}}` | {{failure condition}} |

## See also

- [{{How-to using this}}](../guides/index.md)
