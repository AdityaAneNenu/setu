web: python manage.py migrate --noinput && python manage.py setup_all_users && python manage.py collectstatic --noinput && gunicorn config.wsgi --bind 0.0.0.0:$PORT
