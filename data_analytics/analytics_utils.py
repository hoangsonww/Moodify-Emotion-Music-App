import pandas as pd


def load_csv(path):
    """
    Utility function to load a CSV file into a Pandas DataFrame
    """
    return pd.read_csv(path)


def save_plot(fig, filename):
    """
    Utility function to save a plot
    """
    fig.savefig(filename, bbox_inches='tight')
