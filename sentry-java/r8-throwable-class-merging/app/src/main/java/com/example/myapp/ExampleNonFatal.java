package com.example.myapp;

final class ExampleNonFatal extends RuntimeException {
    ExampleNonFatal(String message) {
        super(message);
    }
}
