"""Modal onboarding smoke — same as dashboard tutorial."""

import modal

app = modal.App("kebabkiller-get-started")


@app.function()
def square(x: int) -> int:
    print("This code is running on a remote worker!")
    return x**2


@app.local_entrypoint()
def main() -> None:
    print("the square is", square.remote(42))
