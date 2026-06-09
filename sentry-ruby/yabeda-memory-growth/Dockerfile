FROM ruby:3.3

WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install
COPY . .

ENTRYPOINT ["bundle", "exec", "ruby", "repro.rb"]
