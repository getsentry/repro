package com.example.myapp

sealed class State {
    object Loading : State() {
        override fun goNuts() {
            throw Exception("loading failed");
        }
    }

    object Error : State() {
        override fun goNuts() {
            throw Exception("error failed");
        }
    }

    class Success(val message: String) : State() {
        override fun goNuts() {
            throw Exception("success failed");
        }
    }

    abstract fun goNuts()
}