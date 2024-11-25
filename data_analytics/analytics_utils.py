import pandas as pd


def load_csv(path):
    """
    Utility function to load a CSV file into a Pandas DataFrame

    :param path: The path to the CSV file
    :return: The loaded DataFrame
    """
    return pd.read_csv(path)


def save_plot(fig, filename):
    """
    Utility function to save a plot

    :param fig: The plot figure
    :param filename: The output filename
    """
    fig.savefig(filename, bbox_inches='tight')
