# frozen_string_literal: true

class TestController < ApplicationController
  def index
    render plain: "OK"
  end
end
