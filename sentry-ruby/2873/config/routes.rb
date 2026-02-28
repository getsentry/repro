# frozen_string_literal: true

Rails.application.routes.draw do
  get "/test", to: "test#index"
end
