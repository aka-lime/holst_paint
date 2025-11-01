# Gemini Code Assistant Context

## Project Overview

This is a simple Python project containing a `factorial` function. The main logic is in `test.py`.

The project uses `mypy` for type checking and `pytest` for testing, although no tests are currently present. It also includes configuration for `black` and `isort` for code formatting.

## Building and Running

*   **Running the file:**
    ```bash
    python test.py
    ```

*   **Running tests:**
    ```bash
    pytest
    ```

*   **Type checking:**
    ```bash
    mypy .
    ```

*   **Code formatting:**
    ```bash
    black .
    isort .
    ```

## Development Conventions

*   Code should be formatted with `black` and `isort`.
*   Code should pass `mypy` type checking.
*   New functionality should be accompanied by `pytest` tests.
